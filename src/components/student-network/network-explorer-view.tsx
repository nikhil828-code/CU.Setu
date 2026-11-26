'use client'

/**
 * Network Explorer — interactive force-directed map of the REAL student
 * graph (nodes = students, edges = accepted connections, pending excluded).
 *
 * Everything shown is computed by the Flask backend over the in-memory
 * SocialGraph (adjacency lists + BFS); this view only renders the result:
 *   /api/network/graph  -> nodes + edges + BFS levels from the viewer
 *   /api/network/path   -> shortest path between any two students
 *   /api/network/bfs    -> step-by-step BFS trace (parent + level + queue)
 *
 * Interactions: drag nodes, pan, wheel-zoom, click a node for its card,
 * search, 1st/2nd/3rd-degree highlights, animated BFS traversal and
 * animated shortest-path reveal — all on one <canvas> driven by rAF.
 */

import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import {
  GitBranch,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Route,
  Search,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { toast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { gradientColorsFor } from '@/lib/avatar'
import type {
  BfsStep,
  BfsTraceResponse,
  GraphNode,
  NetworkGraphResponse,
  PathResponse,
} from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Canvas engine types                                                 */
/* ------------------------------------------------------------------ */

interface SimNode {
  username: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  degree: number
  level: number | null
  avatarUrl: string
  r: number
  fixed: boolean
}

interface Camera {
  x: number
  y: number
  zoom: number
}

interface BfsPlayback {
  steps: BfsStep[]
  idx: number
  playing: boolean
  visited: Set<string>
  discovered: Array<[string, string]>
  lastTs: number
  interval: number
  source: string
}

interface PathPlayback {
  nodes: string[]
  edges: Array<[string, string]>
  revealed: number
  lastTs: number
  distance: number | null
}

const NAVY_BG = '#0A1631'
const EDGE_COLOR = 'rgba(56, 132, 246, 0.18)'
const EDGE_BRIGHT = 'rgba(34, 211, 238, 0.55)'
const ORANGE = '#FB923C'
const CYAN = '#22D3EE'
const ROYAL = '#3B82F6'
const VIOLET = '#8B5CF6'
const DIM = 'rgba(148, 163, 184, 0.35)'

const DEGREE_COLORS: Record<number, string> = { 1: CYAN, 2: ROYAL, 3: VIOLET }

function levelColor(level: number | null): string | null {
  if (level === null) return null
  if (level <= 0) return ORANGE
  if (level <= 3) return DEGREE_COLORS[level]
  return null
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function NetworkExplorerView() {
  const me = useAppStore((s) => s.me)
  const openProfile = useAppStore((s) => s.openProfile)

  const graphQuery = useQuery({
    queryKey: ['network-graph'],
    queryFn: () => apiFetch<NetworkGraphResponse>('/network/graph'),
  })
  const data = graphQuery.data
  /** True once the real (canvas) DOM is mounted — the skeleton renders no canvas. */
  const canvasReady = graphQuery.isSuccess && data !== undefined

  /* ---------------- React-facing UI state ---------------- */
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [hoverName, setHoverName] = useState<string | null>(null)
  const [degreeFilter, setDegreeFilter] = useState<1 | 2 | 3 | null>(null)
  const [search, setSearch] = useState('')
  const [pathA, setPathA] = useState<string>('')
  const [pathB, setPathB] = useState<string>('')
  const [pathResult, setPathResult] = useState<PathResponse | null>(null)
  const [bfsSource, setBfsSource] = useState<string>('')
  const [bfsRunning, setBfsRunning] = useState(false)
  const [bfsProgress, setBfsProgress] = useState({ idx: -1, total: 0 })
  const [bfsSpeed, setBfsSpeed] = useState(1)
  const [bfsCurrent, setBfsCurrent] = useState<BfsStep | null>(null)
  const [runningPath, setRunningPath] = useState(false)
  const [runningBfs, setRunningBfs] = useState(false)

  /* ---------------- Canvas engine refs ---------------- */
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const simNodes = useRef<Map<string, SimNode>>(new Map())
  const simEdges = useRef<Array<[string, string]>>([])
  const adjacency = useRef<Map<string, Set<string>>>(new Map())
  const images = useRef<Map<string, HTMLImageElement>>(new Map())
  const camera = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const camTarget = useRef<Camera | null>(null)
  const alpha = useRef(0)
  const hoverNode = useRef<string | null>(null)
  const dragState = useRef<{
    kind: 'node' | 'pan' | null
    node: string | null
    lastX: number
    lastY: number
    downX: number
    downY: number
    moved: number
  }>({ kind: null, node: null, lastX: 0, lastY: 0, downX: 0, downY: 0, moved: 0 })
  const bfsRef = useRef<BfsPlayback | null>(null)
  const pathRef = useRef<PathPlayback | null>(null)
  const rafRef = useRef<number>(0)
  const sizeRef = useRef({ w: 800, h: 560 })
  const didFit = useRef(false)
  const speedRef = useRef(1)
  const filterRef = useRef<1 | 2 | 3 | null>(null)
  const selectedRef = useRef<string | null>(null)

  useEffect(() => {
    filterRef.current = degreeFilter
  }, [degreeFilter])
  useEffect(() => {
    selectedRef.current = selected?.username ?? null
  }, [selected])
  useEffect(() => {
    speedRef.current = bfsSpeed
    if (bfsRef.current) bfsRef.current.interval = 620 / bfsSpeed
  }, [bfsSpeed])

  /* ---------------- Build the simulation when data arrives ---------------- */
  useEffect(() => {
    if (!data || !me) return
    const count = data.nodes.length
    if (count === 0) return

    // Re-seed only when the node set actually changed.
    const existing = simNodes.current
    const same = new Set([...existing.keys()])
    const incoming = new Set(data.nodes.map((n) => n.username))
    const rebuild = simNodes.current.size === 0 || ![...incoming].every((u) => same.has(u))

    if (rebuild) {
      const map = new Map<string, SimNode>()
      const R = 260
      data.nodes.forEach((node, i) => {
        const angle = (i / count) * Math.PI * 2 + 0.3
        const jitter = 40 * Math.sin(i * 12.9898)
        map.set(node.username, {
          username: node.username,
          label: node.full_name,
          x: Math.cos(angle) * R + jitter,
          y: Math.sin(angle) * R + jitter,
          vx: 0,
          vy: 0,
          degree: node.connections_count,
          level: node.level,
          avatarUrl: node.avatar_url,
          r: Math.min(26, 15 + node.connections_count * 0.8),
          fixed: false,
        })
        if (node.avatar_url) {
          const img = new Image()
          img.decoding = 'async'
          img.src = `/api${node.avatar_url}${node.avatar_url.includes('?') ? '&' : '?'}XTransformPort=5001`
          img.onload = () => images.current.set(node.username, img)
        }
      })
      simNodes.current = map
      simEdges.current = data.edges.map((e) => [e.source, e.target])
      adjacency.current = new Map(data.nodes.map((n) => [n.username, new Set<string>()]))
      for (const [a, b] of simEdges.current) {
        adjacency.current.get(a)?.add(b)
        adjacency.current.get(b)?.add(a)
      }
      alpha.current = 1
      // Default camera: fit everything.
      fitCamera()
    }
  }, [data, me])

  const fitCamera = useCallback(() => {
    const nodes = [...simNodes.current.values()]
    if (nodes.length === 0) return
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const n of nodes) {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
    }
    const { w, h } = sizeRef.current
    const zoom = Math.min(
      2,
      Math.max(0.35, Math.min(w / (maxX - minX + 160), h / (maxY - minY + 160))),
    )
    camera.current = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      zoom,
    }
  }, [])

  /* ---------------- Physics + render loop ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const step = (now: number) => {
      const { w, h } = sizeRef.current
      const nodes = simNodes.current
      const arr = [...nodes.values()]

      // ---- physics (only while the layout is still hot) ----
      if (alpha.current > 0.008 && arr.length > 1) {
        const repulsion = 5200
        for (let i = 0; i < arr.length; i += 1) {
          const a = arr[i]
          for (let j = i + 1; j < arr.length; j += 1) {
            const b = arr[j]
            let dx = b.x - a.x
            let dy = b.y - a.y
            let dist2 = dx * dx + dy * dy
            if (dist2 < 1) {
              dx = Math.random() - 0.5
              dy = Math.random() - 0.5
              dist2 = 1
            }
            const dist = Math.sqrt(dist2)
            const force = repulsion / dist2
            const fx = (dx / dist) * force
            const fy = (dy / dist) * force
            if (!a.fixed) { a.vx -= fx; a.vy -= fy }
            if (!b.fixed) { b.vx += fx; b.vy += fy }
          }
        }
        // springs along edges
        const rest = 120
        for (const [sa, sb] of simEdges.current) {
          const a = nodes.get(sa)
          const b = nodes.get(sb)
          if (!a || !b) continue
          const dx = b.x - a.x
          const dy = b.y - a.y
          const dist = Math.max(1, Math.hypot(dx, dy))
          const force = (dist - rest) * 0.012
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          if (!a.fixed) { a.vx += fx; a.vy += fy }
          if (!b.fixed) { b.vx -= fx; b.vy -= fy }
        }
        // gentle centering + integrate
        for (const n of arr) {
          n.vx -= n.x * 0.0006
          n.vy -= n.y * 0.0006
          if (!n.fixed) {
            n.vx *= 0.82
            n.vy *= 0.82
            n.x += Math.max(-18, Math.min(18, n.vx))
            n.y += Math.max(-18, Math.min(18, n.vy))
          } else {
            n.vx = 0
            n.vy = 0
          }
        }
        alpha.current *= 0.985
      }

      // ---- BFS playback advance ----
      const bfs = bfsRef.current
      if (bfs && bfs.playing && now - bfs.lastTs > bfs.interval) {
        bfs.lastTs = now
        if (bfs.idx < bfs.steps.length - 1) {
          bfs.idx += 1
          const stepData = bfs.steps[bfs.idx]
          bfs.visited.add(stepData.node)
          if (stepData.parent) bfs.discovered.push([stepData.parent, stepData.node])
          setBfsProgress({ idx: bfs.idx, total: bfs.steps.length })
          setBfsCurrent(stepData)
        } else {
          bfs.playing = false
          setBfsRunning(false)
          const last = bfs.steps[bfs.steps.length - 1]
          if (last) setBfsCurrent(last)
        }
      }

      // ---- path reveal advance ----
      const path = pathRef.current
      if (path && path.revealed < path.edges.length && now - path.lastTs > 420) {
        path.lastTs = now
        path.revealed += 1
      }

      // ---- smooth camera glide toward a target ----
      if (camTarget.current) {
        const t = camTarget.current
        camera.current.x += (t.x - camera.current.x) * 0.12
        camera.current.y += (t.y - camera.current.y) * 0.12
        camera.current.zoom += (t.zoom - camera.current.zoom) * 0.12
        if (Math.abs(t.x - camera.current.x) < 0.5
            && Math.abs(t.y - camera.current.y) < 0.5
            && Math.abs(t.zoom - camera.current.zoom) < 0.005) {
          camera.current = { ...t }
          camTarget.current = null
        }
      }

      // ---- render ----
      const cam = camera.current
      const worldToScreenX = (x: number) => (x - cam.x) * cam.zoom + w / 2
      const worldToScreenY = (y: number) => (y - cam.y) * cam.zoom + h / 2

      // navy backdrop with a soft radial vignette
      ctx.fillStyle = NAVY_BG
      ctx.fillRect(0, 0, w, h)
      const grad = ctx.createRadialGradient(w / 2, h / 2, 60, w / 2, h / 2, Math.max(w, h) * 0.75)
      grad.addColorStop(0, 'rgba(37, 78, 160, 0.20)')
      grad.addColorStop(1, 'rgba(5, 10, 26, 0.55)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)

      // adjacency sets for highlighting
      const hover = hoverNode.current
      const hoveredNeighbors = hover ? adjacency.current.get(hover) ?? new Set<string>() : null
      const selectedU = selectedRef.current
      const selNeighbors = selectedU ? adjacency.current.get(selectedU) ?? new Set<string>() : null
      const f = filterRef.current

      // ---------- edges ----------
      for (const [ea, eb] of simEdges.current) {
        const a = nodes.get(ea)
        const b = nodes.get(eb)
        if (!a || !b) continue
        const ax = worldToScreenX(a.x), ay = worldToScreenY(a.y)
        const bx = worldToScreenX(b.x), by = worldToScreenY(b.y)

        let color = EDGE_COLOR
        let width = 1.2

        // BFS discovery edge -> glowing cyan
        const bfs2 = bfsRef.current
        if (bfs2 && bfs2.discovered.some(([p, c]) => (p === ea && c === eb) || (p === eb && c === ea))) {
          color = 'rgba(34, 211, 238, 0.75)'
          width = 2.4
        }
        // shortest-path edge -> orange
        const pth = pathRef.current
        if (pth && pth.revealed > 0) {
          const idx = pth.edges.findIndex(([p, c]) => (p === ea && c === eb) || (p === eb && c === ea))
          if (idx !== -1 && idx < pth.revealed) {
            color = 'rgba(251, 146, 60, 0.9)'
            width = 3
          }
        }
        // hover / selection emphasis
        if (hover && (ea === hover || eb === hover)) { color = EDGE_BRIGHT; width = Math.max(width, 2) }
        if (selectedU && (ea === selectedU || eb === selectedU)) {
          if (color === EDGE_COLOR) color = 'rgba(96, 165, 250, 0.35)'
        }

        ctx.strokeStyle = color
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.stroke()
      }

      // ---------- nodes ----------
      const bfs2 = bfsRef.current
      const pth = pathRef.current
      const pathSet = pth ? new Set(pth.nodes) : null

      for (const n of arr) {
        const sx = worldToScreenX(n.x)
        const sy = worldToScreenY(n.y)
        const r = n.r * cam.zoom
        if (sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) continue

        const isViewer = n.username === me?.username
        const lvlColor = levelColor(n.level)
        const inBfs = bfs2?.visited.has(n.username) ?? false
        const isBfsCurrent = bfs2 && bfs2.steps[bfs2.idx]?.node === n.username
        const inPath = pathSet?.has(n.username) ?? false

        // dim nodes not matching the degree filter
        let dimmed = false
        if (f !== null && n.level !== null && n.level > 0) {
          dimmed = n.level !== f && n.level !== 0
        }

        let ring: string | null = null
        let ringWidth = 2.5
        if (isViewer) { ring = ORANGE; ringWidth = 3 }
        if (lvlColor && !isViewer && f !== null && n.level === f) { ring = lvlColor; ringWidth = 3 }
        if (inPath) { ring = ORANGE; ringWidth = 3 }
        if (inBfs && !ring) { ring = 'rgba(34, 211, 238, 0.8)'; ringWidth = 2 }
        if (n.username === selectedU) { ring = '#FDE68A'; ringWidth = 3.5 }
        if (n.username === hover) { ring = '#E0F2FE'; ringWidth = 2.5 }

        // glow
        const glowR = r * (isBfsCurrent ? 3.2 : isViewer ? 2.2 : 1.9)
        const glowColor = isViewer ? 'rgba(251,146,60,0.35)'
          : inPath ? 'rgba(251,146,60,0.30)'
          : isBfsCurrent ? 'rgba(34,211,238,0.45)'
          : inBfs ? 'rgba(34,211,238,0.22)'
          : 'rgba(59,130,246,0.30)'
        const g = ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, glowR)
        g.addColorStop(0, glowColor)
        g.addColorStop(1, 'rgba(10,22,49,0)')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2)
        ctx.fill()

        // body: avatar image or gradient fill
        ctx.save()
        ctx.beginPath()
        ctx.arc(sx, sy, r, 0, Math.PI * 2)
        ctx.closePath()
        const img = images.current.get(n.username)
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.clip()
          const size = r * 2
          ctx.drawImage(img, sx - r, sy - r, size, size)
          ctx.restore()
        } else {
          ctx.restore()
          const [c1, c2] = gradientColorsFor(n.username)
          const ng = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r)
          ng.addColorStop(0, dimmed ? DIM : c1)
          ng.addColorStop(1, dimmed ? 'rgba(100,116,139,0.3)' : c2)
          ctx.fillStyle = ng
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fill()
          // initials
          ctx.fillStyle = dimmed ? 'rgba(203,213,225,0.4)' : 'rgba(255,255,255,0.92)'
          ctx.font = `${Math.max(9, Math.round(r * 0.62))}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const initials = n.label.split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('')
          ctx.fillText(initials, sx, sy + 0.5)
        }

        if (dimmed) {
          ctx.fillStyle = 'rgba(10,22,49,0.55)'
          ctx.beginPath()
          ctx.arc(sx, sy, r, 0, Math.PI * 2)
          ctx.fill()
        }

        // ring
        if (ring) {
          ctx.strokeStyle = ring
          ctx.lineWidth = ringWidth * cam.zoom
          ctx.beginPath()
          ctx.arc(sx, sy, r + 2.5 * cam.zoom, 0, Math.PI * 2)
          ctx.stroke()
        }
        // pulsing halo for the current BFS step
        if (isBfsCurrent) {
          const pulse = (Math.sin(now / 180) * 0.5 + 0.5)
          ctx.strokeStyle = `rgba(224,242,254,${0.7 * pulse})`
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(sx, sy, r + 6 + pulse * 10, 0, Math.PI * 2)
          ctx.stroke()
        }

        // label
        const showLabel = cam.zoom > 0.75 || n.username === hover || n.username === selectedU || isViewer
        if (showLabel) {
          ctx.font = `${Math.max(10, Math.round(11 * Math.min(1, cam.zoom)))}px ui-sans-serif, system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'top'
          ctx.fillStyle = dimmed ? 'rgba(148,163,184,0.5)' : 'rgba(226,232,240,0.92)'
          ctx.fillText(n.label, sx, sy + r + 5 * cam.zoom)
        }
      }

      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [me, canvasReady])

  /* ---------------- Resize observer ---------------- */
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const apply = () => {
      const rect = wrap.getBoundingClientRect()
      sizeRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // Fit the graph exactly once, with the REAL measured dimensions
      // (the data effect fits earlier with the default size).
      if (!didFit.current && simNodes.current.size > 0 && rect.width > 0) {
        didFit.current = true
        fitCamera()
      }
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [canvasReady])

  /* ---------------- Pointer interactions ---------------- */
  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { w, h } = sizeRef.current
    const cam = camera.current
    const px = clientX - rect.left
    const py = clientY - rect.top
    const wx = (px - w / 2) / cam.zoom + cam.x
    const wy = (py - h / 2) / cam.zoom + cam.y
    let best: string | null = null
    let bestDist = Infinity
    for (const n of simNodes.current.values()) {
      const d = Math.hypot(n.x - wx, n.y - wy)
      // generous proximity radius: the network cursor highlights nearby
      // nodes, not just the exact one under the pointer
      if (d < n.r + 16 && d < bestDist) {
        best = n.username
        bestDist = d
      }
    }
    return best
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onPointerDown = (e: PointerEvent) => {
      const hit = hitTest(e.clientX, e.clientY)
      dragState.current = {
        kind: hit ? 'node' : 'pan',
        node: hit,
        lastX: e.clientX,
        lastY: e.clientY,
        downX: e.clientX,
        downY: e.clientY,
        moved: 0,
      }
      if (hit) {
        const n = simNodes.current.get(hit)
        if (n) n.fixed = true
      }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e: PointerEvent) => {
      const hit = hitTest(e.clientX, e.clientY)
      if (hit !== hoverNode.current) {
        hoverNode.current = hit
        setHoverName(hit)
      }
      const ds = dragState.current
      if (ds.kind === null) return
      const dx = e.clientX - ds.lastX
      const dy = e.clientY - ds.lastY
      ds.moved += Math.abs(dx) + Math.abs(dy)
      ds.lastX = e.clientX
      ds.lastY = e.clientY
      if (ds.kind === 'node' && ds.node) {
        const n = simNodes.current.get(ds.node)
        if (n) {
          n.x += dx / camera.current.zoom
          n.y += dy / camera.current.zoom
          alpha.current = Math.max(alpha.current, 0.25)
        }
      } else if (ds.kind === 'pan') {
        camera.current.x -= dx / camera.current.zoom
        camera.current.y -= dy / camera.current.zoom
        camTarget.current = null
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      const ds = dragState.current
      if (ds.node) {
        const n = simNodes.current.get(ds.node)
        if (n) n.fixed = false
      }
      // click (not drag) -> select / deselect
      if (ds.moved < 6) {
        const hit = hitTest(e.clientX, e.clientY)
        if (hit) {
          const node = data?.nodes.find((n) => n.username === hit) ?? null
          setSelected(node)
          // clearing other overlays when focusing one student
        } else {
          setSelected(null)
        }
      }
      dragState.current = { kind: null, node: null, lastX: 0, lastY: 0, downX: 0, downY: 0, moved: 0 }
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const canvas2 = canvasRef.current
      if (!canvas2) return
      const rect = canvas2.getBoundingClientRect()
      const { w, h } = sizeRef.current
      const cam = camera.current
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      const wx = (px - w / 2) / cam.zoom + cam.x
      const wy = (py - h / 2) / cam.zoom + cam.y
      const factor = Math.exp(-e.deltaY * 0.0012)
      cam.zoom = Math.min(3, Math.max(0.3, cam.zoom * factor))
      // keep the world point under the cursor stable
      cam.x = wx - (px - w / 2) / cam.zoom
      cam.y = wy - (py - h / 2) / cam.zoom
      camTarget.current = null
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
    }
  }, [hitTest, data])

  /* ---------------- Actions ---------------- */
  const centerOn = useCallback((username: string) => {
    const n = simNodes.current.get(username)
    if (!n) return
    camTarget.current = { x: n.x, y: n.y, zoom: Math.max(camera.current.zoom, 1.15) }
  }, [])

  const resetLayout = useCallback(() => {
    const arr = [...simNodes.current.values()]
    const count = arr.length
    arr.forEach((n, i) => {
      const angle = (i / count) * Math.PI * 2 + 0.3
      n.x = Math.cos(angle) * 260 + 40 * Math.sin(i * 12.9898)
      n.y = Math.sin(angle) * 260 + 40 * Math.cos(i * 7.233)
      n.vx = 0
      n.vy = 0
    })
    alpha.current = 1
    fitCamera()
  }, [fitCamera])

  const zoomBy = useCallback((factor: number) => {
    const cam = camera.current
    camTarget.current = { x: cam.x, y: cam.y, zoom: Math.min(3, Math.max(0.3, cam.zoom * factor)) }
  }, [])

  const findPath = useCallback(async () => {
    if (!pathA || !pathB || pathA === pathB) {
      toast({ title: 'Pick two different students', description: 'Choose a source and a target for the path.' })
      return
    }
    setRunningPath(true)
    try {
      const resp = await apiFetch<PathResponse>(
        `/network/path?from=${encodeURIComponent(pathA)}&to=${encodeURIComponent(pathB)}`,
      )
      setPathResult(resp)
      // reset BFS overlay so the path owns the canvas
      bfsRef.current = null
      setBfsRunning(false)
      setBfsProgress({ idx: -1, total: 0 })
      setBfsCurrent(null)
      if (resp.path && resp.path.length > 1) {
        const edges: Array<[string, string]> = []
        for (let i = 0; i < resp.path.length - 1; i += 1) edges.push([resp.path[i], resp.path[i + 1]])
        pathRef.current = {
          nodes: resp.path,
          edges,
          revealed: 0,
          lastTs: performance.now(),
          distance: resp.distance,
        }
        toast({
          title: `Shortest path: ${resp.distance} ${resp.distance === 1 ? 'hop' : 'hops'}`,
          description: 'Found by BFS on the student graph.',
        })
      } else {
        pathRef.current = null
        toast({ title: 'No connection path', description: 'These two students are not connected through anyone yet.' })
      }
    } catch (err) {
      toast({ title: 'Path search failed', description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setRunningPath(false)
    }
  }, [pathA, pathB])

  const runBfs = useCallback(async () => {
    const source = bfsSource || me?.username || ''
    if (!source) return
    setRunningBfs(true)
    try {
      const resp = await apiFetch<BfsTraceResponse>(`/network/bfs?from=${encodeURIComponent(source)}`)
      // clear the path overlay so BFS owns the canvas
      pathRef.current = null
      setPathResult(null)
      bfsRef.current = {
        steps: resp.steps,
        idx: 0,
        playing: true,
        visited: new Set([resp.steps[0]?.node ?? source]),
        discovered: [],
        lastTs: performance.now(),
        interval: 620 / speedRef.current,
        source,
      }
      setBfsRunning(true)
      setBfsProgress({ idx: 0, total: resp.steps.length })
      setBfsCurrent(resp.steps[0] ?? null)
    } catch (err) {
      toast({ title: 'BFS failed', description: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      setRunningBfs(false)
    }
  }, [bfsSource, me])

  const pauseResumeBfs = useCallback(() => {
    const bfs = bfsRef.current
    if (!bfs) return
    bfs.playing = !bfs.playing
    setBfsRunning(bfs.playing)
    if (bfs.playing) bfs.lastTs = performance.now()
  }, [])

  /* ---------------- Derived UI data ---------------- */
  const nodeOptions = useMemo(
    () =>
      (data?.nodes ?? [])
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((n) => ({ value: n.username, label: `${n.full_name} (@${n.username})` })),
    [data],
  )

  const searchResults = useMemo(() => {
    if (!data || search.trim() === '') return []
    const q = search.trim().toLowerCase()
    return data.nodes
      .filter((n) => n.full_name.toLowerCase().includes(q) || n.username.toLowerCase().includes(q))
      .slice(0, 6)
  }, [data, search])

  const findNode = (username: string): GraphNode | undefined => data?.nodes.find((n) => n.username === username)

  const setPathFromSelected = (which: 'A' | 'B') => {
    if (!selected) return
    if (which === 'A') setPathA(selected.username)
    else setPathB(selected.username)
    toast({ title: `Path ${which === 'A' ? 'source' : 'target'} set`, description: `@${selected.username}` })
  }

  /* ---------------- Render ---------------- */
  if (graphQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SectionHeader title="Network Explorer" subtitle="Loading the student graph…" />
        <div className="h-[70vh] animate-pulse rounded-2xl bg-[#0A1631]" />
      </div>
    )
  }
  if (graphQuery.isError || !data || !me) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <SectionHeader title="Network Explorer" subtitle="The live student graph" />
        <EmptyState
          icon={Users}
          title="Graph unavailable"
          description="The network graph could not be loaded. Refresh and try again."
        />
      </div>
    )
  }

  const stats = data.stats
  const selNode = selected ? findNode(selected.username) ?? selected : null

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <SectionHeader
        title="Network Explorer"
        subtitle="The real CU.Setu graph — nodes are students, edges are accepted connections. Drag, zoom, run BFS, find shortest paths."
      />

      {/* stats + legend */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge className="border-white/10 bg-[#0F1F46] text-slate-200">
          {stats.nodes} students
        </Badge>
        <Badge className="border-white/10 bg-[#0F1F46] text-slate-200">
          {stats.edges} connections
        </Badge>
        <Badge className="border-white/10 bg-[#0F1F46] text-slate-200">
          avg degree {stats.avg_degree}
        </Badge>
        <span className="mx-1 hidden h-4 w-px bg-border sm:block" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: ORANGE }} aria-hidden="true" />
            you
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: CYAN }} aria-hidden="true" />
            1st degree
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: ROYAL }} aria-hidden="true" />
            2nd
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: VIOLET }} aria-hidden="true" />
            3rd
          </span>
        </div>
        <div className="ml-auto flex gap-1.5">
          {([1, 2, 3] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDegreeFilter(degreeFilter === d ? null : d)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                degreeFilter === d
                  ? 'border-transparent text-white'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              )}
              style={degreeFilter === d ? { background: DEGREE_COLORS[d] } : undefined}
              aria-pressed={degreeFilter === d}
            >
              {d === 1 ? '1st' : d === 2 ? '2nd' : '3rd'} degree
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Canvas */}
        <div className="relative min-h-[420px] flex-1 overflow-hidden rounded-2xl border border-white/10 shadow-lg lg:min-h-[640px]">
          <div ref={wrapRef} className="h-[70vh] max-h-[760px] min-h-[420px] w-full">
            <canvas
              ref={canvasRef}
              className="block h-full w-full touch-none"
              aria-label="Student network graph"
              role="img"
            />
          </div>

          {/* canvas controls */}
          <div className="absolute right-3 top-3 flex flex-col gap-1.5">
            <Button size="icon" variant="secondary" className="size-9 shadow-md" onClick={() => zoomBy(1.3)} aria-label="Zoom in">
              <ZoomIn className="size-4" />
            </Button>
            <Button size="icon" variant="secondary" className="size-9 shadow-md" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">
              <ZoomOut className="size-4" />
            </Button>
            <Button size="icon" variant="secondary" className="size-9 shadow-md" onClick={fitCamera} aria-label="Fit graph to view">
              <MousePointer2 className="size-4" />
            </Button>
            <Button size="icon" variant="secondary" className="size-9 shadow-md" onClick={resetLayout} aria-label="Reset layout">
              <RotateCcw className="size-4" />
            </Button>
          </div>

          {/* hover nameplate */}
          <AnimatePresence>
            {hoverName ? (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="pointer-events-none absolute bottom-3 left-3 rounded-lg bg-[#0A1631]/85 px-3 py-1.5 text-xs font-medium text-slate-100 backdrop-blur"
              >
                @{hoverName} · {findNode(hoverName)?.connections_count ?? 0} connections
                <span className="ml-2 text-slate-400">click for details</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* search overlay */}
          <div className="absolute left-3 top-3 w-56">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a student…"
                className="h-9 border-white/10 bg-[#0A1631]/80 pl-9 text-slate-100 placeholder:text-slate-500 backdrop-blur"
                aria-label="Search students on the graph"
              />
            </div>
            {searchResults.length > 0 ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0A1631]/95 shadow-xl backdrop-blur">
                {searchResults.map((n) => (
                  <button
                    key={n.username}
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-200 hover:bg-white/10"
                    onClick={() => {
                      setSelected(n)
                      centerOn(n.username)
                      setSearch('')
                    }}
                  >
                    <span className="size-6 shrink-0 overflow-hidden rounded-full bg-[#1E3A8A]">
                      {n.avatar_url ? (
                        <img
                          src={`/api${n.avatar_url}${n.avatar_url.includes('?') ? '&' : '?'}XTransformPort=5001`}
                          alt=""
                          className="size-6 object-cover"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{n.full_name}</span>
                    <span className="text-slate-500">@{n.username}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Side panel */}
        <aside className="w-full space-y-4 lg:w-80">
          {/* selected student card */}
          <AnimatePresence mode="popLayout">
            {selNode ? (
              <motion.div
                key={selNode.username}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar
                    username={selNode.username}
                    fullName={selNode.full_name}
                    avatarUrl={selNode.avatar_url}
                    size="lg"
                    onClick={() => openProfile(selNode.username)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{selNode.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{selNode.username}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {selNode.programme || 'Student'}{selNode.year ? ` · ${selNode.year}` : ''}
                    </p>
                  </div>
                  <Button size="icon" variant="ghost" className="size-7" onClick={() => setSelected(null)} aria-label="Close student card">
                    <span aria-hidden="true">×</span>
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{selNode.connections_count} connections</Badge>
                  {selNode.level !== null && selNode.level > 0 ? (
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                      {selNode.level} {selNode.level === 1 ? 'hop' : 'hops'} from you
                    </Badge>
                  ) : selNode.username === me.username ? (
                    <Badge className="bg-orange-500 text-white">This is you</Badge>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openProfile(selNode.username)}>
                    View profile
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => centerOn(selNode.username)}>
                    Center node
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPathFromSelected('A')}>
                    Set as path A
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPathFromSelected('B')}>
                    Set as path B
                  </Button>
                </div>
                <Button
                  size="sm"
                  className="mt-1.5 w-full"
                  onClick={() => {
                    setBfsSource(selNode.username)
                    toast({ title: 'BFS source set', description: `Run the traversal from @${selNode.username}.` })
                  }}
                >
                  <GitBranch className="mr-1.5 size-4" />
                  BFS from this student
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* shortest path finder */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Route className="size-4 text-orange-600" aria-hidden="true" />
              <h3 className="text-sm font-semibold">Shortest path finder</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              BFS guarantees the fewest hops between two students.
            </p>
            <div className="mt-3 space-y-2">
              <div>
                <Label htmlFor="path-a" className="text-xs text-muted-foreground">From</Label>
                <Select value={pathA} onValueChange={setPathA}>
                  <SelectTrigger id="path-a" className="mt-1 h-9 w-full">
                    <SelectValue placeholder="Pick a student" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {nodeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="path-b" className="text-xs text-muted-foreground">To</Label>
                <Select value={pathB} onValueChange={setPathB}>
                  <SelectTrigger id="path-b" className="mt-1 h-9 w-full">
                    <SelectValue placeholder="Pick a student" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {nodeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={findPath} disabled={runningPath || !pathA || !pathB}>
                {runningPath ? 'Finding…' : 'Find shortest path'}
              </Button>
            </div>
            {pathResult?.path && pathResult.path.length > 1 ? (
              <div className="mt-3 rounded-lg bg-muted/60 p-3">
                <p className="text-xs font-medium">
                  {pathResult.distance} {pathResult.distance === 1 ? 'hop' : 'hops'} ·{' '}
                  {pathResult.path.length} students in the chain
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {pathResult.path.map((u, i) => (
                    <span key={u} className="flex items-center gap-1">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {u}
                      </Badge>
                      {i < (pathResult.path?.length ?? 0) - 1 ? (
                        <span className="text-muted-foreground" aria-hidden="true">→</span>
                      ) : null}
                    </span>
                  ))}
                </div>
              </div>
            ) : pathResult && !pathResult.path ? (
              <p className="mt-3 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                No path exists between these two students yet.
              </p>
            ) : null}
          </div>

          {/* BFS animation */}
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <GitBranch className="size-4 text-blue-600" aria-hidden="true" />
              <h3 className="text-sm font-semibold">BFS traversal</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Watch the real breadth-first search explore the graph level by level.
            </p>
            <div className="mt-3">
              <Label htmlFor="bfs-source" className="text-xs text-muted-foreground">Source</Label>
              <Select value={bfsSource || me.username} onValueChange={setBfsSource}>
                <SelectTrigger id="bfs-source" className="mt-1 h-9 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {nodeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button className="flex-1" onClick={runBfs} disabled={runningBfs}>
                {runningBfs ? 'Running…' : bfsRef.current ? 'Restart BFS' : 'Run BFS animation'}
              </Button>
              {bfsProgress.idx >= 0 ? (
                <Button size="icon" variant="outline" onClick={pauseResumeBfs} aria-label={bfsRunning ? 'Pause' : 'Resume'}>
                  {bfsRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
              ) : null}
            </div>
            {bfsProgress.idx >= 0 ? (
              <div className="mt-3 space-y-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all"
                    style={{ width: `${((bfsProgress.idx + 1) / Math.max(1, bfsProgress.total)) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Step {bfsProgress.idx + 1} / {bfsProgress.total}
                  {bfsCurrent ? (
                    <>
                      {' '}— dequeued <span className="font-mono text-foreground">@{bfsCurrent.node}</span>
                      {bfsCurrent.parent ? (
                        <> (found via <span className="font-mono text-foreground">@{bfsCurrent.parent}</span>)</>
                      ) : null} at level {bfsCurrent.level}
                    </>
                  ) : null}
                </p>
                {bfsCurrent && bfsCurrent.queue.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Queue (front → back)
                    </p>
                    <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                      {bfsCurrent.queue.map((u) => (
                        <Badge key={u} variant="outline" className="font-mono text-[10px]">
                          {u}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="bfs-speed" className="text-xs text-muted-foreground">Speed {bfsSpeed}×</Label>
                  <Slider
                    id="bfs-speed"
                    value={[bfsSpeed]}
                    onValueChange={(v) => setBfsSpeed(v[0] ?? 1)}
                    min={0.5}
                    max={3}
                    step={0.5}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

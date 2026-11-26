'use client'

/**
 * NetworkCursor — CU.Setu's advanced "digital network" cursor.
 *
 * Layers
 * -------
 * 1. INNER DOT   a small royal-blue glowing dot that follows the pointer
 *                INSTANTLY (no easing) — the actual pointing node.
 * 2. OUTER RING  a larger transparent ring with a cyan/blue halo that
 *                follows on a delay (lerp), like a lagging satellite.
 * 3. PARTICLES   moving the pointer spawns glowing blue/cyan particles.
 *                Particles close to each other are linked with thin
 *                lines — a miniature "digital network" that fades out
 *                and self-cleans (bounded quantity).
 * 4. LOGO LINK   hovering the official logo animates a dashed link with
 *                two nodes — the cursor node connecting to the logo node.
 *
 * Context behaviour
 * -----------------
 *  - buttons            -> the ring expands
 *  - navigation links   -> the ring grows further and turns cyan
 *  - profile cards      -> gentle magnetic pull toward the pointer
 *  - text inputs        -> the custom layers fade out; the NORMAL text
 *                          caret takes over (native cursor: text)
 *  - everywhere else   -> the native cursor is hidden (cursor: none via
 *                          a scoped stylesheet, removed on unmount)
 *
 * Engineering notes: one rAF loop, pure transform/canvas writes, passive
 * listeners only (clicks, scroll and text selection are untouched).
 * Disabled on touch/coarse pointers and when prefers-reduced-motion is on.
 */

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  decay: number
  size: number
  color: string
}

const MAX_PARTICLES = 70
const LINK_DISTANCE = 82 // particle-to-particle network links
const CURSOR_LINK_DISTANCE = 110 // cursor-to-particle links

const PALETTE = ['#60A5FA', '#38BDF8', '#22D3EE', '#2563EB', '#67E8F9']

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [role="tab"], [role="menuitem"], summary, label, [data-cursor="hover"]'
const INPUT_SELECTOR = 'input, textarea, [contenteditable="true"]'
const CARD_SELECTOR = '.card'
const LOGO_SELECTOR = 'img[src="/cu-setu-logo.png"]'

const CURSOR_STYLE_ID = 'cu-network-cursor-style'
const CURSOR_ACTIVE_CLASS = 'cu-network-cursor-on'
const CURSOR_CSS = `
@media (hover: hover) and (pointer: fine) {
  html.${CURSOR_ACTIVE_CLASS} body, html.${CURSOR_ACTIVE_CLASS} body * { cursor: none !important; }
  html.${CURSOR_ACTIVE_CLASS} input, html.${CURSOR_ACTIVE_CLASS} textarea,
  html.${CURSOR_ACTIVE_CLASS} [contenteditable="true"] { cursor: text !important; }
}`

export function NetworkCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ringRef = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Touch / coarse-pointer devices get no cursor experience at all.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const canvas = canvasRef.current
    const ring = ringRef.current
    const dot = dotRef.current
    if (!canvas || !ring || !dot) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ------------------------------ state ------------------------------ //
    let mx = -100
    let my = -100
    let ringX = -100
    let ringY = -100
    let ringScale = 1
    let ringScaleTarget = 1
    let ringCyan = false
    let textMode = false
    let shown = false
    let raf = 0
    let lastFrame = performance.now()
    let lastSpawnX = -100
    let lastSpawnY = -100

    const particles: Particle[] = []
    let magnetic: { el: HTMLElement; cx: number; cy: number } | null = null
    let logoCenter: { x: number; y: number } | null = null

    // --------------------- scoped cursor:none stylesheet ----------------- //
    let styleEl: HTMLStyleElement | null = document.getElementById(CURSOR_STYLE_ID) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = CURSOR_STYLE_ID
      styleEl.textContent = CURSOR_CSS
      document.head.appendChild(styleEl)
    }
    document.documentElement.classList.add(CURSOR_ACTIVE_CLASS)

    // ------------------------------ canvas ----------------------------- //
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const spawnParticle = (x: number, y: number, vx: number, vy: number) => {
      if (particles.length >= MAX_PARTICLES) particles.shift()
      particles.push({
        x, y, vx, vy,
        life: 1,
        decay: 0.45 + Math.random() * 0.45,
        size: 1 + Math.random() * 1.8,
        color: PALETTE[(Math.random() * PALETTE.length) | 0],
      })
    }

    const drawParticles = (dt: number) => {
      const w = window.innerWidth
      const h = window.innerHeight
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      const dt60 = dt * 60
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]
        p.life -= p.decay * dt
        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }
        p.x += p.vx * dt60
        p.y += p.vy * dt60
        p.vx *= 0.96
        p.vy *= 0.96
        ctx.globalAlpha = Math.max(p.life, 0) * 0.85
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(p.size * p.life, 0.3), 0, Math.PI * 2)
        ctx.fill()
      }

      // particle <-> particle links (the "digital network")
      ctx.globalAlpha = 1
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i]
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist2 = dx * dx + dy * dy
          if (dist2 < LINK_DISTANCE * LINK_DISTANCE) {
            const dist = Math.sqrt(dist2)
            const strength = (1 - dist / LINK_DISTANCE) * Math.min(a.life, b.life)
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.38 * strength})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }

      // cursor <-> nearby particles links
      if (shown && !textMode) {
        for (const p of particles) {
          const dx = p.x - mx
          const dy = p.y - my
          const dist2 = dx * dx + dy * dy
          if (dist2 < CURSOR_LINK_DISTANCE * CURSOR_LINK_DISTANCE) {
            const dist = Math.sqrt(dist2)
            const strength = (1 - dist / CURSOR_LINK_DISTANCE) * p.life
            ctx.strokeStyle = `rgba(37, 99, 235, ${0.30 * strength})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(mx, my)
            ctx.lineTo(p.x, p.y)
            ctx.stroke()
          }
        }
      }

      // the logo link animation — two nodes + a live dashed connection
      if (logoCenter && shown && !textMode) {
        const { x: lx, y: ly } = logoCenter
        const t = performance.now()
        ctx.globalAlpha = 1
        // dashed, flowing link line
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.8)'
        ctx.lineWidth = 1.4
        ctx.setLineDash([7, 9])
        ctx.lineDashOffset = -(t / 45) % 16
        ctx.beginPath()
        ctx.moveTo(mx, my)
        ctx.lineTo(lx, ly)
        ctx.stroke()
        ctx.setLineDash([])
        // node at the logo end (+ gentle pulse)
        const pulse = 8 + Math.sin(t / 260) * 2.5
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.9)'
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.arc(lx, ly, pulse, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = 'rgba(251, 146, 60, 0.5)'
        ctx.beginPath()
        ctx.arc(lx, ly, 2.4, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    // --------------------------- interactions -------------------------- //
    const clearMagnetic = () => {
      if (magnetic) {
        magnetic.el.style.transition = 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)'
        magnetic.el.style.transform = ''
        magnetic = null
      }
    }

    const applyMagnetic = (el: Element | null) => {
      const card = el instanceof HTMLElement ? el.closest(CARD_SELECTOR) : null
      if (card instanceof HTMLElement) {
        const rect = card.getBoundingClientRect()
        magnetic = { el: card, cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
        card.style.transition = 'transform 120ms ease-out'
      } else {
        clearMagnetic()
      }
    }

    const magnetize = () => {
      if (!magnetic) return
      const dx = mx - magnetic.cx
      const dy = my - magnetic.cy
      const norm = Math.min(1, Math.hypot(dx, dy) / 160)
      magnetic.el.style.transform =
        `translate(${(dx / 160) * 7 * norm}px, ${(dy / 160) * 7 * norm}px)`
    }

    const onMove = (event: MouseEvent) => {
      const px = event.clientX
      const py = event.clientY
      if (!shown) {
        shown = true
        ringX = px
        ringY = py
      }
      mx = px
      my = py

      // spawn particles only when the pointer actually travelled
      const dx = px - lastSpawnX
      const dy = py - lastSpawnY
      if (dx * dx + dy * dy > 30) {
        const ang = Math.atan2(-dy, -dx)
        spawnParticle(px, py, Math.cos(ang) * 0.4 + (Math.random() - 0.5) * 0.8,
                      Math.sin(ang) * 0.4 + (Math.random() - 0.5) * 0.8)
        lastSpawnX = px
        lastSpawnY = py
      }

      // context detection
      const target = event.target as Element | null
      const inInput = Boolean(target?.closest?.(INPUT_SELECTOR))
      if (inInput !== textMode) {
        textMode = inInput
        ring.style.transition = textMode ? 'opacity 220ms ease' : 'opacity 120ms ease'
      }
      if (textMode) {
        ringScaleTarget = 1
        ringCyan = false
        clearMagnetic()
        logoCenter = null
      } else {
        const interactive = target?.closest?.(INTERACTIVE_SELECTOR) ?? null
        const inNav = Boolean(interactive?.closest?.('nav'))
        ringCyan = inNav
        ringScaleTarget = inNav ? 2.1 : interactive ? 1.6 : 1
        applyMagnetic(target)
        magnetize()
        // logo proximity: approaching any official logo links the cursor
        // node to the logo node with the animated dashed connection
        logoCenter = null
        const logos = document.querySelectorAll(LOGO_SELECTOR)
        for (const logo of logos) {
          const rect = logo.getBoundingClientRect()
          if (rect.width === 0) continue
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          if (Math.hypot(mx - cx, my - cy) < 130) {
            logoCenter = { x: cx, y: cy }
            break
          }
        }
      }
    }

    const onDown = (event: MouseEvent) => {
      if (textMode) return
      ringScaleTarget = Math.max(ringScaleTarget * 0.8, 0.8)
      // a small burst of network particles on click
      for (let i = 0; i < 8; i += 1) {
        const ang = (i / 8) * Math.PI * 2 + Math.random() * 0.5
        const speed = 0.8 + Math.random() * 1.6
        spawnParticle(event.clientX, event.clientY,
                      Math.cos(ang) * speed, Math.sin(ang) * speed)
      }
    }

    const onLeaveDocument = () => {
      shown = false
      particles.length = 0
      clearMagnetic()
    }

    // ------------------------------ loop ------------------------------- //
    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      ringX += (mx - ringX) * 0.16 // delayed satellite follow
      ringY += (my - ringY) * 0.16
      ringScale += (ringScaleTarget - ringScale) * 0.14

      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`
      ring.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${ringScale.toFixed(3)})`
      dot.style.opacity = textMode ? '0' : shown ? '1' : '0'
      ring.style.opacity = textMode ? '0' : shown ? '1' : '0'
      ring.style.borderColor = ringCyan ? 'rgba(103, 232, 249, 0.85)' : 'rgba(56, 189, 248, 0.55)'
      ring.style.boxShadow = ringCyan
        ? '0 0 24px rgba(34, 211, 238, 0.45), inset 0 0 16px rgba(34, 211, 238, 0.22)'
        : '0 0 18px rgba(56, 189, 248, 0.30), inset 0 0 12px rgba(59, 130, 246, 0.16)'

      drawParticles(dt)
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeaveDocument)
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      document.documentElement.removeEventListener('mouseleave', onLeaveDocument)
      cancelAnimationFrame(raf)
      clearMagnetic()
      document.documentElement.classList.remove(CURSOR_ACTIVE_CLASS)
      const style = document.getElementById(CURSOR_STYLE_ID)
      if (style) style.remove()
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] hidden [@media(hover:hover)_and_(pointer:fine)]:block"
    >
      {/* particles + network links + logo link animation */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full" style={{ willChange: 'contents' }} />
      {/* outer ring — delayed satellite with a cyan/blue halo */}
      <div
        ref={ringRef}
        className="absolute left-0 top-0 size-[34px] rounded-full border-[1.5px] opacity-0"
        style={{
          borderColor: 'rgba(56, 189, 248, 0.55)',
          boxShadow: '0 0 18px rgba(56, 189, 248, 0.30), inset 0 0 12px rgba(59, 130, 246, 0.16)',
          willChange: 'transform, opacity',
        }}
      />
      {/* inner dot — the royal-blue node, instantly under the pointer */}
      <div
        ref={dotRef}
        className="absolute left-0 top-0 size-[7px] rounded-full opacity-0"
        style={{
          background: '#2563EB',
          boxShadow: '0 0 10px rgba(37, 99, 235, 0.95), 0 0 22px rgba(59, 130, 246, 0.45)',
          willChange: 'transform, opacity',
        }}
      />
    </div>
  )
}

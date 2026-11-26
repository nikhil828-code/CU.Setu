'use client'

/**
 * NetworkCursor — CU.Setu's refined, minimal cursor.
 *
 * Layers
 * -------
 * 1. INNER DOT   a small royal-blue dot that follows the pointer
 *                INSTANTLY — the actual pointing node.
 * 2. OUTER RING  a soft cyan ring that follows on a gentle delay; grows
 *                over links/buttons and turns cyan inside nav bars.
 * 3. TRAIL       a handful of quiet blue/cyan sparks trail the pointer
 *                (canvas, NO connecting lines, bounded count) plus a tiny
 *                ripple on click.
 *
 * Context behaviour
 * -----------------
 *  - buttons / links     -> the ring expands gently
 *  - navigation bars     -> the ring grows a touch more and turns cyan
 *  - text inputs         -> the custom layers fade out; the native text
 *                          caret takes over (cursor: text)
 *
 * Engineering notes: one rAF loop, pure transform/canvas writes, passive
 * listeners only. Disabled on touch/coarse pointers and when
 * prefers-reduced-motion is on.
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

const MAX_PARTICLES = 22
const TRAIL_COLORS = ['#38BDF8', '#67E8F9', '#2563EB']

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], [role="tab"], [role="menuitem"], summary, label, [data-cursor="hover"]'
const INPUT_SELECTOR = 'input, textarea, [contenteditable="true"]'

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
        x,
        y,
        vx,
        vy,
        life: 1,
        decay: 0.6 + Math.random() * 0.5,
        size: 0.9 + Math.random() * 1.1,
        color: TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0],
      })
    }

    const drawTrail = (dt: number) => {
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
        p.vx *= 0.94
        p.vy *= 0.94
        ctx.globalAlpha = Math.max(p.life, 0) * 0.5
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, Math.max(p.size * p.life, 0.25), 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }

    // --------------------------- interactions -------------------------- //
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

      // spawn a quiet spark only when the pointer actually travelled
      const dx = px - lastSpawnX
      const dy = py - lastSpawnY
      if (dx * dx + dy * dy > 36) {
        spawnParticle(px, py, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)
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
      } else {
        const interactive = target?.closest?.(INTERACTIVE_SELECTOR) ?? null
        const inNav = Boolean(interactive?.closest?.('nav'))
        ringCyan = inNav
        ringScaleTarget = inNav ? 1.9 : interactive ? 1.5 : 1
      }
    }

    const onDown = (event: MouseEvent) => {
      if (textMode) return
      ringScaleTarget = Math.max(ringScaleTarget * 0.85, 0.85)
      // a tiny, quiet ripple on click
      for (let i = 0; i < 6; i += 1) {
        const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.4
        const speed = 0.5 + Math.random() * 0.9
        spawnParticle(event.clientX, event.clientY, Math.cos(ang) * speed, Math.sin(ang) * speed)
      }
    }

    const onLeaveDocument = () => {
      shown = false
      particles.length = 0
    }

    // ------------------------------ loop ------------------------------- //
    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      ringX += (mx - ringX) * 0.16 // gentle delayed follow
      ringY += (my - ringY) * 0.16
      ringScale += (ringScaleTarget - ringScale) * 0.14

      dot.style.transform = `translate3d(${mx}px, ${my}px, 0) translate(-50%, -50%)`
      ring.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${ringScale.toFixed(3)})`
      dot.style.opacity = textMode ? '0' : shown ? '1' : '0'
      ring.style.opacity = textMode ? '0' : shown ? '1' : '0'
      ring.style.borderColor = ringCyan ? 'rgba(103, 232, 249, 0.8)' : 'rgba(56, 189, 248, 0.5)'
      ring.style.boxShadow = ringCyan
        ? '0 0 20px rgba(34, 211, 238, 0.35), inset 0 0 12px rgba(34, 211, 238, 0.18)'
        : '0 0 14px rgba(56, 189, 248, 0.22), inset 0 0 10px rgba(59, 130, 246, 0.14)'

      drawTrail(dt)
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
      {/* quiet spark trail (no connecting lines) */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full" style={{ willChange: 'contents' }} />
      {/* outer ring — gentle delayed ring with a soft cyan halo */}
      <div
        ref={ringRef}
        className="absolute left-0 top-0 size-[32px] rounded-full border-[1.5px] opacity-0"
        style={{
          borderColor: 'rgba(56, 189, 248, 0.5)',
          boxShadow: '0 0 14px rgba(56, 189, 248, 0.22), inset 0 0 10px rgba(59, 130, 246, 0.14)',
          willChange: 'transform, opacity',
        }}
      />
      {/* inner dot — the royal-blue node, instantly under the pointer */}
      <div
        ref={dotRef}
        className="absolute left-0 top-0 size-[7px] rounded-full opacity-0"
        style={{
          background: '#2563EB',
          boxShadow: '0 0 8px rgba(37, 99, 235, 0.9), 0 0 18px rgba(59, 130, 246, 0.4)',
          willChange: 'transform, opacity',
        }}
      />
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'

/**
 * CursorGlow — a playful multi-layer cursor experience.
 *
 * Layers:
 *   1. Spark trail (canvas) — tiny amber / orange embers scatter behind the
 *      pointer while it moves, drift upward and fade out.
 *   2. Click burst (canvas) — a ring of sparks explodes from the pointer on
 *      every mousedown.
 *   3. Soft halo that brightens while the cursor is moving.
 *   4. Easing ring (lerp follow) that swells over interactive elements
 *      (links, buttons, inputs) and squeezes while pressed.
 *   5. Instant glowing dot that tracks the pointer 1:1.
 *
 * Everything is driven by one requestAnimationFrame loop with pure
 * transform / canvas writes — no React re-renders while the cursor moves.
 * The whole layer is display:none on touch devices (hover:hover +
 * pointer:fine media query) and the effect is skipped entirely when the
 * user prefers reduced motion.
 */

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number // 1 -> 0
  decay: number // life lost per second
  size: number
  color: string
}

const SPARK_COLORS = ['#FDE68A', '#FBBF24', '#F59E0B', '#F97316', '#FFFBEB']
const MAX_SPARKS = 220
const HOVER_SELECTOR =
  'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor="hover"]'

export function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    const halo = haloRef.current
    const canvas = canvasRef.current
    if (!dot || !ring || !halo || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let dotX = -100
    let dotY = -100
    let ringX = -100
    let ringY = -100
    let lastSparkX = -100
    let lastSparkY = -100
    let shown = false
    let moving = false
    let moveTimer: ReturnType<typeof setTimeout> | undefined
    let raf = 0
    let lastFrame = performance.now()

    // Ring states eased inside the animation loop.
    let ringScale = 1
    let targetScale = 1
    let pressed = false
    let hovering = false

    const sparks: Spark[] = []

    // ------------------------------------------------------------------ //
    // Canvas sizing (device-pixel-ratio aware)
    // ------------------------------------------------------------------ //
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * dpr)
      canvas.height = Math.round(window.innerHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const spawnSpark = (
      x: number,
      y: number,
      speed: number,
      angle: number,
      size: number,
      decay: number,
    ) => {
      if (sparks.length >= MAX_SPARKS) sparks.shift()
      sparks.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay,
        size,
        color: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
      })
    }

    const trailSparks = (x: number, y: number, dx: number, dy: number) => {
      // 2 embers per spawn point, biased slightly against the movement
      // direction so the trail streams behind the pointer.
      const baseAngle = Math.atan2(-dy, -dx)
      for (let i = 0; i < 2; i++) {
        const angle = baseAngle + (Math.random() - 0.5) * 1.6
        spawnSpark(x, y, Math.random() * 1.4 + 0.2, angle, Math.random() * 2 + 0.8, 1.1 + Math.random() * 0.9)
      }
    }

    const burstSparks = (x: number, y: number) => {
      const count = 18
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.35
        const speed = Math.random() * 2.6 + 1.4
        spawnSpark(x, y, speed, angle, Math.random() * 2.4 + 1.2, 1.8 + Math.random() * 1.2)
      }
    }

    const drawSparks = (dtSeconds: number) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      if (sparks.length === 0) return
      ctx.globalCompositeOperation = 'lighter'
      const dt60 = dtSeconds * 60
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.life -= s.decay * dtSeconds
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        s.x += s.vx * dt60
        s.y += s.vy * dt60
        s.vx *= 0.955
        s.vy = s.vy * 0.955 - 0.018 * dt60 // gentle upward drift
        const alpha = Math.max(s.life, 0) * 0.9
        ctx.globalAlpha = alpha
        ctx.fillStyle = s.color
        ctx.beginPath()
        ctx.arc(s.x, s.y, Math.max(s.size * s.life, 0.4), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    // ------------------------------------------------------------------ //
    // Pointer events
    // ------------------------------------------------------------------ //
    const onMove = (event: MouseEvent) => {
      const x = event.clientX
      const y = event.clientY
      if (!shown) {
        shown = true
        ringX = x
        ringY = y
        dot.style.opacity = '1'
        ring.style.opacity = '1'
        halo.style.opacity = '1'
      }

      // Spawn trail sparks only when the pointer actually travelled.
      const dx = x - lastSparkX
      const dy = y - lastSparkY
      if (dx * dx + dy * dy > 36) {
        trailSparks(x, y, dx, dy)
        lastSparkX = x
        lastSparkY = y
      }

      dotX = x
      dotY = y
      moving = true
      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`
      if (moveTimer) clearTimeout(moveTimer)
      moveTimer = setTimeout(() => {
        moving = false
      }, 180)

      // Swell over anything interactive.
      const target = event.target as Element | null
      hovering = Boolean(target?.closest?.(HOVER_SELECTOR))
      targetScale = hovering ? 1.6 : pressed ? 0.72 : 1
      ring.style.borderColor = hovering
        ? 'rgba(251, 191, 36, 0.95)'
        : 'rgba(251, 146, 60, 0.7)'
    }

    const onDown = (event: MouseEvent) => {
      pressed = true
      targetScale = hovering ? 1.1 : 0.72
      burstSparks(event.clientX, event.clientY)
    }
    const onUp = () => {
      pressed = false
      targetScale = hovering ? 1.6 : 1
    }
    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
      halo.style.opacity = '0'
      shown = false
      sparks.length = 0
    }

    const tick = (now: number) => {
      const dtSeconds = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      // The ring eases towards the dot position — classic lerp follow.
      ringX += (dotX - ringX) * 0.18
      ringY += (dotY - ringY) * 0.18
      ringScale += (targetScale - ringScale) * 0.22
      ring.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) ` +
        `scale(${ringScale.toFixed(3)})`
      halo.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)` +
        (hovering ? ' scale(1.25)' : '')
      halo.style.opacity = moving ? '1' : '0.45'

      drawSparks(dtSeconds)
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown, { passive: true })
    window.addEventListener('mouseup', onUp, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      if (moveTimer) clearTimeout(moveTimer)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] hidden [@media(hover:hover)_and_(pointer:fine)]:block"
    >
      {/* Spark trail + click bursts */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full"
        style={{ willChange: 'contents' }}
      />
      {/* Soft halo that brightens while the cursor is moving */}
      <div
        ref={haloRef}
        className="absolute left-0 top-0 size-40 rounded-full bg-amber-400/10 blur-2xl transition-opacity duration-300"
        style={{ opacity: 0, willChange: 'transform, opacity' }}
      />
      {/* Easing ring */}
      <div
        ref={ringRef}
        className="absolute left-0 top-0 size-9 rounded-full border-2 border-amber-400/70 transition-[border-color] duration-150"
        style={{
          opacity: 0,
          willChange: 'transform',
          boxShadow: '0 0 14px rgba(251, 146, 60, 0.35)',
        }}
      />
      {/* Instant dot */}
      <div
        ref={dotRef}
        className="absolute left-0 top-0 size-1.5 rounded-full bg-amber-400"
        style={{
          opacity: 0,
          willChange: 'transform',
          boxShadow: '0 0 10px 2px rgba(251, 146, 60, 0.8)',
        }}
      />
    </div>
  )
}

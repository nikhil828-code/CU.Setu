'use client'

import { useEffect, useRef } from 'react'

/**
 * CursorGlow — a playful golden cursor experience.
 *
 * Layers:
 *   1. Spark trail (canvas) — tiny amber / orange embers scatter behind the
 *      pointer while it moves, drift upward and fade out.
 *   2. Click burst (canvas) — a ring of sparks explodes from the pointer on
 *      every mousedown.
 *   3. Soft halo that brightens while the cursor is moving and swells a
 *      little over interactive elements.
 *   4. Grow effect — whatever interactive element the cursor rests on
 *      (link, button, menu item…) gently scales up, so the thing under the
 *      pointer always feels lifted.
 *
 * The former easing ring and glowing dot were removed — the page's own
 * controls plus the halo now carry the whole effect.
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
/** Elements that get the golden halo while hovered. */
const HOVER_SELECTOR =
  'a, button, [role="button"], input, textarea, select, label, summary, [data-cursor="hover"]'
/** Elements that physically grow a little under the cursor. */
const GROW_SELECTOR =
  'a, button, [role="button"], [role="menuitem"], [role="tab"], select, summary, [data-cursor="hover"]'
const GROW_SCALE = '1.06'
const GROW_TRANSITION = 'scale 170ms cubic-bezier(0.22, 1, 0.36, 1)'

export function CursorGlow() {
  const haloRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Touch / coarse-pointer devices get no cursor experience at all —
    // the visual layer is hidden by CSS and the effects are skipped here.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const halo = haloRef.current
    const canvas = canvasRef.current
    if (!halo || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let x = -100
    let y = -100
    let haloX = -100
    let haloY = -100
    let lastSparkX = -100
    let lastSparkY = -100
    let shown = false
    let moving = false
    let moveTimer: ReturnType<typeof setTimeout> | undefined
    let raf = 0
    let lastFrame = performance.now()

    // Halo states eased inside the animation loop.
    let haloScale = 1
    let haloTargetScale = 1
    let pressed = false
    let hovering = false

    const sparks: Spark[] = []

    // ------------------------------------------------------------------ //
    // Grow effect — lift the element the cursor rests on.
    // ------------------------------------------------------------------ //
    let growEl: HTMLElement | null = null

    const clearGrow = () => {
      if (growEl) {
        growEl.style.scale = ''
        growEl.style.transition = ''
        growEl = null
      }
    }

    const applyGrow = (el: Element | null) => {
      if (el === growEl) return
      clearGrow()
      // Only grow real, enabled controls; skip anything mid-interaction.
      if (
        el instanceof HTMLElement &&
        !el.closest('[aria-disabled="true"]') &&
        !el.hasAttribute('disabled') &&
        !el.closest('[data-cursor="no-grow"]')
      ) {
        el.style.transition = GROW_TRANSITION
        el.style.scale = GROW_SCALE
        growEl = el
      }
    }

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
      const px = event.clientX
      const py = event.clientY
      if (!shown) {
        shown = true
        haloX = px
        haloY = py
        halo.style.opacity = '1'
      }

      // Spawn trail sparks only when the pointer actually travelled.
      const dx = px - lastSparkX
      const dy = py - lastSparkY
      if (dx * dx + dy * dy > 36) {
        trailSparks(px, py, dx, dy)
        lastSparkX = px
        lastSparkY = py
      }

      x = px
      y = py
      moving = true
      if (moveTimer) clearTimeout(moveTimer)
      moveTimer = setTimeout(() => {
        moving = false
      }, 180)

      const target = event.target as Element | null
      hovering = Boolean(target?.closest?.(HOVER_SELECTOR))
      haloTargetScale = pressed ? 0.85 : hovering ? 1.18 : 1
      applyGrow(target?.closest?.(GROW_SELECTOR) ?? null)
    }

    const onDown = (event: MouseEvent) => {
      pressed = true
      haloTargetScale = 0.85
      burstSparks(event.clientX, event.clientY)
    }
    const onUp = () => {
      pressed = false
      haloTargetScale = hovering ? 1.18 : 1
    }
    const onLeave = () => {
      halo.style.opacity = '0'
      shown = false
      sparks.length = 0
      clearGrow()
    }

    const tick = (now: number) => {
      const dtSeconds = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      // The halo glides after the pointer — a soft trailing glow.
      haloX += (x - haloX) * 0.3
      haloY += (y - haloY) * 0.3
      haloScale += (haloTargetScale - haloScale) * 0.18
      halo.style.transform =
        `translate3d(${haloX}px, ${haloY}px, 0) translate(-50%, -50%) ` +
        `scale(${haloScale.toFixed(3)})`
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
      clearGrow()
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
      {/* Soft golden halo that brightens while the cursor is moving */}
      <div
        ref={haloRef}
        className="absolute left-0 top-0 size-40 rounded-full bg-amber-400/10 blur-2xl transition-opacity duration-300"
        style={{ opacity: 0, willChange: 'transform, opacity' }}
      />
    </div>
  )
}

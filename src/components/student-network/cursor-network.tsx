'use client'

/**
 * NetworkCursor — CU.Setu's subtle cursor trail.
 *
 * All custom cursor layers (dot, ring) were removed: the NORMAL native
 * OS cursor stays fully visible and untouched. This is purely a gentle
 * decorative effect layered on top:
 *
 *  - TRAIL   a handful of quiet blue/cyan sparks trail the pointer
 *            (canvas, NO connecting lines, bounded count)
 *  - CLICK   a tiny, quiet spark ripple on click
 *
 * Engineering notes: one rAF loop, pure canvas writes, passive
 * listeners only (clicks, scroll and text selection are untouched).
 * Disabled on touch/coarse pointers and when prefers-reduced-motion
 * is on.
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

export function NetworkCursor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Touch / coarse-pointer devices get no cursor trail at all.
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // ------------------------------ state ------------------------------ //
    let raf = 0
    let lastFrame = performance.now()
    let lastSpawnX = -100
    let lastSpawnY = -100

    const particles: Particle[] = []

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

      // spawn a quiet spark only when the pointer actually travelled
      const dx = px - lastSpawnX
      const dy = py - lastSpawnY
      if (dx * dx + dy * dy > 36) {
        spawnParticle(px, py, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.5)
        lastSpawnX = px
        lastSpawnY = py
      }
    }

    const onDown = (event: MouseEvent) => {
      // a tiny, quiet ripple on click
      for (let i = 0; i < 6; i += 1) {
        const ang = (i / 6) * Math.PI * 2 + Math.random() * 0.4
        const speed = 0.5 + Math.random() * 0.9
        spawnParticle(event.clientX, event.clientY, Math.cos(ang) * speed, Math.sin(ang) * speed)
      }
    }

    const onLeaveDocument = () => {
      particles.length = 0
    }

    // ------------------------------ loop ------------------------------- //
    const tick = (now: number) => {
      const dt = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

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
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[90] hidden [@media(hover:hover)_and_(pointer:fine)]:block"
    >
      {/* quiet spark trail — no dot, no ring, no connecting lines */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full" style={{ willChange: 'contents' }} />
    </div>
  )
}

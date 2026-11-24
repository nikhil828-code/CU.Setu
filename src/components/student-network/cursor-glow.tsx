'use client'

import { useEffect, useRef } from 'react'

/**
 * CursorGlow — a playful cursor animation that follows the pointer.
 *
 * Two layers trail the cursor:
 *   1. a small glowing amber dot that tracks the pointer almost 1:1
 *   2. a larger soft ring that eases after it (lerp), giving a fluid
 *      "comet" feel, plus a faint halo that brightens while moving.
 *
 * Visibility is governed purely by CSS (@media hover:hover + pointer:fine —
 * the container is display:none on touch devices), while the tracking loop
 * skips work entirely when the user prefers reduced motion. Pure transform
 * updates inside a requestAnimationFrame loop — no React re-renders while
 * the cursor moves.
 */
export function CursorGlow() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const haloRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    const halo = haloRef.current
    if (!dot || !ring || !halo) return

    let dotX = -100
    let dotY = -100
    let ringX = -100
    let ringY = -100
    let shown = false
    let moving = false
    let moveTimer: ReturnType<typeof setTimeout> | undefined
    let raf = 0

    const onMove = (event: MouseEvent) => {
      dotX = event.clientX
      dotY = event.clientY
      if (!shown) {
        shown = true
        ringX = dotX
        ringY = dotY
        dot.style.opacity = '1'
        ring.style.opacity = '1'
        halo.style.opacity = '1'
      }
      moving = true
      dot.style.transform = `translate3d(${dotX}px, ${dotY}px, 0) translate(-50%, -50%)`
      if (moveTimer) clearTimeout(moveTimer)
      moveTimer = setTimeout(() => {
        moving = false
      }, 180)
    }

    const onDown = () => ring.style.setProperty('--press', '0.72')
    const onUp = () => ring.style.setProperty('--press', '1')
    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
      halo.style.opacity = '0'
    }

    const tick = () => {
      // The ring eases towards the dot position — classic lerp follow.
      ringX += (dotX - ringX) * 0.18
      ringY += (dotY - ringY) * 0.18
      ring.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) ` +
        `scale(var(--press, 1))`
      halo.style.transform =
        `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`
      halo.style.opacity = moving ? '1' : '0.45'
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.documentElement.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
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

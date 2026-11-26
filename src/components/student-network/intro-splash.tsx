'use client'

/**
 * Official CU.Setu intro — the full-screen brand video plays ONCE per
 * browser session (sessionStorage flag), then "docks" into the page
 * logo: the final frame shrinks smoothly into the exact logo position
 * of the view underneath and cross-fades into the real logo.
 *
 * Behaviour:
 *  - video plays FULL SCREEN (object-cover) while it runs
 *  - guests are funnelled to the login page — the video shrinks into
 *    the login page logo (top-centre), exactly where the brand mark sits
 *  - logged-in visitors dock into the app header logo instead
 *  - muted, autoplay, playsinline, no loop
 *  - prefers-reduced-motion  -> never plays (gated in app-root)
 *  - video error / missing   -> static logo fallback, quick fade
 *  - skip button            -> jumps straight into the docking animation
 *  - the app boots underneath meanwhile, so the landing/login page is
 *    already rendered when the video docks into its logo
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { useAppStore } from '@/store/app-store'

const INTRO_VIDEO = '/static/assets/branding/cus_entry_animation.mp4'
const LOGO_SELECTOR = 'img[src="/cu-setu-logo.png"]'
const OVERLAY_FLAG = 'data-intro-overlay'

const DOCK_MS = 950 // shrink-to-logo duration
const FADE_MS = 520 // final overlay fade
const RENDER_BEAT_MS = 180 // wait for the dock target view to lay out

/** Docking geometry: how the full-screen layer shrinks into the logo rect. */
interface Dock {
  left: number
  top: number
  width: number
  height: number
  x: number
  y: number
  scaleX: number
  scaleY: number
}

type Phase = 'video' | 'fallback' | 'dock' | 'fading'

export function IntroSplash() {
  const introDone = useAppStore((s) => s.introDone)
  const [phase, setPhase] = useState<Phase>('video')
  const [dock, setDock] = useState<Dock | null>(null)
  const timers = useRef<number[]>([])
  const dockStarted = useRef(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    return () => {
      for (const t of timers.current) window.clearTimeout(t)
    }
  }, [])

  /** Find the logo of the page underneath (header logo preferred). */
  const measureLogo = (): Dock | null => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    let best: { rect: DOMRect; score: number } | null = null
    for (const logo of Array.from(document.querySelectorAll(LOGO_SELECTOR))) {
      // ignore our own fallback / ghost marks inside this overlay
      if (logo.closest(`[${OVERLAY_FLAG}]`)) continue
      const rect = logo.getBoundingClientRect()
      if (rect.width < 8 || rect.height < 8) continue // hidden / not laid out
      const inHeader = logo.closest('header') !== null
      const score = rect.width * rect.height * (inHeader ? 4 : 1)
      if (!best || score > best.score) best = { rect, score }
    }
    if (!best) return null
    const { left, top, width, height } = best.rect
    return {
      left,
      top,
      width,
      height,
      x: left + width / 2 - vw / 2,
      y: top + height / 2 - vh / 2,
      scaleX: width / vw,
      scaleY: height / vh,
    }
  }

  const finish = () => {
    if (phase === 'fading') return
    setPhase('fading')
    timers.current.push(window.setTimeout(() => introDone(), FADE_MS))
  }

  /** Video ended (or skipped): shrink into the page logo, then fade out. */
  const startDock = () => {
    if (dockStarted.current) return
    dockStarted.current = true

    // The entry funnel for guests is: intro -> login page. Switching the
    // view here means the video docks into the LOGIN PAGE logo, right
    // where the brand mark sits on that screen.
    const { me, view, goto } = useAppStore.getState()
    if (!me && view === 'landing') goto('login')

    // give the switched view a beat to render before measuring its logo
    timers.current.push(
      window.setTimeout(() => {
        setDock(measureLogo())
        setPhase('dock')
        timers.current.push(window.setTimeout(finish, DOCK_MS))
      }, RENDER_BEAT_MS),
    )
  }

  const onVideoError = () => {
    if (dockStarted.current || phase !== 'video') return
    // genuine failure only — a recovered stall must not kill the intro
    const v = videoRef.current
    if (v && v.readyState >= 2 && !v.error) return
    dockStarted.current = true
    // Video failed (unsupported codec / missing file): show the static
    // brand mark for a moment, then fade out.
    setPhase('fallback')
    timers.current.push(window.setTimeout(finish, 1400))
  }

  const dockAnimate = dock
    ? { x: dock.x, y: dock.y, scaleX: dock.scaleX, scaleY: dock.scaleY, opacity: 0 }
    : { scale: 0.72, opacity: 0 }

  const isDocking = phase === 'dock' || phase === 'fading'

  return (
    <AnimatePresence>
      <motion.div
        key="cu-setu-intro"
        data-intro-overlay=""
        className="fixed inset-0 z-[100] overflow-hidden bg-[#0A1631]"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'fading' ? 0 : 1 }}
        transition={{ duration: FADE_MS / 1000, ease: 'easeInOut' }}
        role="dialog"
        aria-label="CU.Setu intro animation"
      >
        {/* soft ambient glows matching the brand */}
        <span aria-hidden="true" className="absolute -left-24 top-1/4 size-72 rounded-full bg-amber-500/10 blur-3xl" />
        <span aria-hidden="true" className="absolute -right-24 bottom-1/4 size-80 rounded-full bg-blue-500/10 blur-3xl" />

        {phase === 'fallback' ? (
          <motion.div
            key="intro-fallback"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-5"
          >
            <BrandMark className="h-28 w-auto" />
            <p className="text-lg font-semibold text-white">
              CU.<span className="text-amber-400">Setu</span>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="intro-video-layer"
            className="absolute inset-0"
            initial={false}
            animate={isDocking ? dockAnimate : { x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1 }}
            transition={isDocking ? { duration: DOCK_MS / 1000, ease: [0.65, 0, 0.35, 1] } : { duration: 0.3 }}
            style={{ transformOrigin: 'center center', willChange: 'transform, opacity' }}
          >
            <video
              ref={videoRef}
              src={INTRO_VIDEO}
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={startDock}
              onError={onVideoError}
              onStalled={() => {
                // long stall (very slow disk) — treat like a failure
                timers.current.push(window.setTimeout(onVideoError, 4000))
              }}
              className="h-full w-full object-cover"
              aria-hidden="true"
            />
          </motion.div>
        )}

        {/* the ghost logo that receives the docking video — lands exactly
            on the real logo, then fades away with the overlay to reveal it */}
        {dock && isDocking ? (
          <motion.div
            key="intro-ghost-logo"
            className="absolute"
            style={{ left: dock.left, top: dock.top, width: dock.width, height: dock.height }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: DOCK_MS / 2000, ease: 'easeOut' }}
          >
            <BrandMark className="h-full w-full" />
          </motion.div>
        ) : null}

        {phase === 'video' ? (
          <button
            type="button"
            onClick={startDock}
            className="absolute bottom-6 right-6 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-slate-300 backdrop-blur transition-colors hover:bg-white/10 hover:text-white"
          >
            Skip intro
          </button>
        ) : null}

        <span className="absolute bottom-6 left-6 text-[11px] tracking-wider text-slate-600" aria-hidden="true">
          CU.SETU · OFFICIAL INTRO
        </span>
      </motion.div>
    </AnimatePresence>
  )
}

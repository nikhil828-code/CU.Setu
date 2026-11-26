'use client'

/**
 * Official CU.Setu intro animation — the full-screen splash that plays the
 * brand video ONCE per browser session (sessionStorage flag), then fades
 * into the app with the tagline.
 *
 * Behaviour:
 *  - deep-navy backdrop, video centred with object-fit: contain
 *  - muted, autoplay, playsinline, no loop
 *  - prefers-reduced-motion  -> never plays
 *  - video error / missing   -> static logo fallback, still fades out
 *  - skip button             -> immediate, polite exit
 *  - the app boots underneath meanwhile (landing page preloaded)
 */

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { useAppStore } from '@/store/app-store'

const INTRO_VIDEO = '/static/assets/branding/cus_entry_animation.mp4'
const TAGLINE = 'Bridging Students, Connecting Possibilities.'

type Phase = 'video' | 'fallback' | 'tagline' | 'fading'

export function IntroSplash() {
  const introDone = useAppStore((s) => s.introDone)
  const [phase, setPhase] = useState<Phase>('video')
  const timers = useRef<number[]>([])

  useEffect(() => {
    return () => {
      for (const t of timers.current) window.clearTimeout(t)
    }
  }, [])

  const finish = () => {
    if (phase === 'fading') return
    setPhase('fading')
    // a beat of tagline + a smooth fade before unmounting
    timers.current.push(window.setTimeout(() => introDone(), 750))
  }

  const onVideoEnded = () => {
    if (phase !== 'video') return
    setPhase('tagline')
    timers.current.push(window.setTimeout(finish, 1500))
  }

  const onVideoError = () => {
    // Video failed (unsupported codec / missing file): show the static
    // brand mark for a moment, then fade out exactly like the video path.
    if (phase !== 'video') return
    setPhase('fallback')
    timers.current.push(window.setTimeout(() => {
      setPhase('tagline')
      timers.current.push(window.setTimeout(finish, 1500))
    }, 1400))
  }

  return (
    <AnimatePresence>
      <motion.div
        key="cu-setu-intro"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0A1631]"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'fading' ? 0 : 1 }}
        transition={{ duration: 0.65, ease: 'easeInOut' }}
        role="dialog"
        aria-label="CU.Setu intro animation"
      >
        {/* soft ambient glows matching the brand */}
        <span aria-hidden="true" className="absolute -left-24 top-1/4 size-72 rounded-full bg-amber-500/10 blur-3xl" />
        <span aria-hidden="true" className="absolute -right-24 bottom-1/4 size-80 rounded-full bg-blue-500/10 blur-3xl" />

        {phase === 'video' || phase === 'tagline' ? (
          <motion.video
            key="intro-video"
            src={INTRO_VIDEO}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={onVideoEnded}
            onError={onVideoError}
            onStalled={() => {
              // long stall (very slow disk) — treat like a failure
              timers.current.push(window.setTimeout(onVideoError, 4000))
            }}
            className="max-h-screen w-full object-contain"
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: phase === 'video' ? 1 : 0.25, scale: phase === 'video' ? 1 : 1.015 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            aria-hidden="true"
          />
        ) : (
          <motion.div
            key="intro-fallback"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="flex flex-col items-center gap-5"
          >
            <BrandMark className="h-28 w-auto" />
            <p className="text-lg font-semibold text-white">
              CU.<span className="text-amber-400">Setu</span>
            </p>
          </motion.div>
        )}

        {(phase === 'tagline' || phase === 'fallback') ? (
          <motion.p
            key="tagline"
            className="absolute bottom-24 px-6 text-center text-sm font-medium tracking-[0.18em] text-slate-300 sm:text-base"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {TAGLINE}
          </motion.p>
        ) : null}

        {phase === 'video' ? (
          <button
            type="button"
            onClick={finish}
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

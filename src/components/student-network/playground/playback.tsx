'use client'

/**
 * Shared playback engine for the DSA Playground visualizers.
 *
 * Every visualizer derives its visible state PURELY from steps[0..index] —
 * nothing is mutated during the animation; stepping backwards or jumping is
 * always safe because the state is a function of the step index alone.
 */

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

const MIN_SPEED = 0.5
const MAX_SPEED = 3
/** Milliseconds per step at 1x — the visualizers are legible at this pace. */
const BASE_INTERVAL = 850

export interface PlaybackController {
  index: number
  playing: boolean
  speed: number
  atEnd: boolean
  total: number
  setSpeed: (value: number) => void
  play: () => void
  pause: () => void
  toggle: () => void
  next: () => void
  prev: () => void
  restart: () => void
  jumpTo: (index: number) => void
  jumpToEnd: () => void
}

export function usePlayback(totalSteps: number): PlaybackController {
  const safeTotal = Math.max(totalSteps, 1)
  const [index, setIndex] = useState(0)
  const [playingIntent, setPlayingIntent] = useState(false)
  const [speed, setSpeed] = useState(1)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clamp = useCallback(
    (value: number) => Math.min(Math.max(value, 0), safeTotal - 1),
    [safeTotal],
  )

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }, [])

  const atEnd = index >= safeTotal - 1
  /** Effective playing flag — the intent only counts while steps remain. */
  const playing = playingIntent && !atEnd

  useEffect(() => {
    if (!playingIntent || atEnd) return
    // `index` is a dependency on purpose: each tick re-schedules the timer,
    // which keeps the pace in sync with speed changes and stops at the end.
    timer.current = setTimeout(() => {
      setIndex((current) => Math.min(current + 1, safeTotal - 1))
    }, BASE_INTERVAL / speed)
    return clearTimer
  }, [playingIntent, atEnd, index, speed, safeTotal, clearTimer])

  const jumpTo = useCallback(
    (value: number) => setIndex(clamp(value)),
    [clamp],
  )

  return {
    index,
    playing,
    speed,
    total: safeTotal,
    atEnd,
    setSpeed,
    play: () => {
      if (atEnd) setIndex(0)
      setPlayingIntent(true)
    },
    pause: () => setPlayingIntent(false),
    toggle: () => {
      if (playing) {
        setPlayingIntent(false)
      } else {
        if (atEnd) setIndex(0)
        setPlayingIntent(true)
      }
    },
    next: () => {
      setPlayingIntent(false)
      setIndex((current) => clamp(current + 1))
    },
    prev: () => {
      setPlayingIntent(false)
      setIndex((current) => clamp(current - 1))
    },
    restart: () => {
      setPlayingIntent(false)
      setIndex(0)
    },
    jumpTo,
    jumpToEnd: () => {
      setPlayingIntent(false)
      setIndex(safeTotal - 1)
    },
  }
}

interface PlaybackBarProps {
  playback: PlaybackController
  stepLabel: string
  className?: string
}

/** Transport controls + speed slider + "Step i / N" progress. */
export function PlaybackBar({ playback, stepLabel, className }: PlaybackBarProps) {
  const { index, total } = playback
  const progress = total > 1 ? (index / (total - 1)) * 100 : 100

  return (
    <div
      className={cn('rounded-xl border border-border bg-card p-3 shadow-sm', className)}
      role="group"
      aria-label="Playback controls"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={playback.restart}
            aria-label="Restart from step 0"
            title="Restart"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={playback.prev}
            disabled={index === 0}
            aria-label="Previous step"
            title="Previous step"
          >
            <SkipBack className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={playback.toggle}
            className="h-9 gap-1.5 rounded-lg bg-[#0F1F46] px-3 text-white hover:bg-[#1B2F5E]"
            aria-pressed={playback.playing}
          >
            {playback.playing ? (
              <>
                <Pause className="size-4" aria-hidden="true" /> Pause
              </>
            ) : (
              <>
                <Play className="size-4" aria-hidden="true" />
                {playback.atEnd ? 'Replay' : 'Play'}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={playback.next}
            disabled={playback.atEnd}
            aria-label="Next step"
            title="Next step"
          >
            <SkipForward className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <span className="ml-1 text-xs font-medium tabular-nums text-slate-500">
          Step <span className="font-semibold text-[#0F1F46]">{index + 1}</span> / {total}
          <span className="mx-1.5 text-slate-300" aria-hidden="true">|</span>
          <span className="text-slate-600">{stepLabel}</span>
        </span>

        <div className="ml-auto flex min-w-36 items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Speed</span>
          <Slider
            value={[playback.speed]}
            onValueChange={(values) => playback.setSpeed(values[0] ?? 1)}
            min={MIN_SPEED}
            max={MAX_SPEED}
            step={0.25}
            className="w-24"
            aria-label="Playback speed"
          />
          <span className="w-9 text-right text-xs font-semibold tabular-nums text-[#0F1F46]">
            {playback.speed.toFixed(2).replace(/\.?0+$/, '')}x
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Progress value={progress} className="h-1.5 flex-1" aria-label="Replay progress" />
        <span className="text-[11px] font-semibold tabular-nums text-slate-400">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  )
}

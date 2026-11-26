'use client'

/**
 * Heap tab — a min-heap priority queue replayed step by step (push / sift-up
 * swaps / authoritative state snapshots / pop_min with re-heapify), computed
 * by the real Python Heap implementation. Two synchronized views: the array
 * (index boxes) and the binary tree (parent i -> children 2i+1, 2i+2).
 *
 * State derivation is pure: replaying steps[0..index] re-builds the array —
 * push appends, swap exchanges positions i and j, state is the authoritative
 * snapshot, and pop_min records the root leaving (the following state step
 * shows the re-heapified array without it).
 */

import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Info } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PlaybackBar, usePlayback } from '@/components/student-network/playground/playback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import type { PlaygroundHeapResponse, PlaygroundHeapStep } from '@/lib/types'
import { cn } from '@/lib/utils'

interface HeapItem {
  label: string
  value: number
}

function formatValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function deriveHeapState(steps: PlaygroundHeapStep[], index: number) {
  const arr: HeapItem[] = []
  const popped: HeapItem[] = []
  for (let k = 0; k <= index; k++) {
    const step = steps[k]
    if (step.op === 'push') {
      arr.push({ label: step.label, value: step.value })
    } else if (step.op === 'swap') {
      const a = arr[step.i]
      const b = arr[step.j]
      if (a && b) {
        arr[step.i] = b
        arr[step.j] = a
      }
    } else if (step.op === 'state') {
      arr.length = 0
      step.labels.forEach((label, i) => arr.push({ label, value: step.values[i] }))
    } else {
      popped.push({ label: step.label, value: step.value })
    }
  }
  return { arr, popped }
}

function stepLabel(step: PlaygroundHeapStep): string {
  switch (step.op) {
    case 'push':
      return `push ${step.label} (${formatValue(step.value)}) — ${step.note}`
    case 'swap':
      return `swap positions ${step.i} ↔ ${step.j}`
    case 'state':
      return 'array settled (authoritative snapshot)'
    case 'pop_min':
      return `pop_min ${step.label} (${formatValue(step.value)}) — ${step.note}`
  }
}

/* ------------------------------ tree geometry ----------------------------- */

const TREE_W = 720
const LEVEL_H = 96
const NODE_R = 23

function treePosition(i: number): { x: number; y: number } {
  const depth = Math.floor(Math.log2(i + 1))
  const indexInLevel = i + 1 - 2 ** depth
  const slots = 2 ** depth
  return {
    x: ((indexInLevel + 0.5) * TREE_W) / slots,
    y: 40 + depth * LEVEL_H,
  }
}

function HeapReplay({ data }: { data: PlaygroundHeapResponse }) {
  const playback = usePlayback(data.steps.length)

  const derived = useMemo(
    () => deriveHeapState(data.steps, playback.index),
    [data, playback.index],
  )

  const step = data.steps[playback.index]
  const swapIndices = step?.op === 'swap' ? [step.i, step.j] : []
  /** Items already popped but still visible at the tail during re-heapify. */
  const poppedSet = new Set(derived.popped.map((item) => item.label))

  const depth = derived.arr.length > 0 ? Math.floor(Math.log2(derived.arr.length)) + 1 : 1
  const treeHeight = 40 + depth * LEVEL_H

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-[#0F1F46]">Mode:</span> {data.mode}
        <span className="mx-2 text-slate-300" aria-hidden="true">|</span>
        <span className="text-xs">
          {data.items.length} items, {data.steps.length} steps
        </span>
      </p>

      <div className="grid gap-4 xl:grid-cols-2">
        {/* (a) array view */}
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Array view — index 0 is the root (smallest priority)
            </h3>
            <div className="mt-3 min-h-28 overflow-x-auto pb-2 pt-6">
              {derived.arr.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-400">heap is empty</p>
              ) : (
                <ol className="flex items-end gap-2 pr-2">
                  <AnimatePresence initial={false}>
                    {derived.arr.map((item, i) => {
                      const inSwap = swapIndices.includes(i)
                      const isLeaving = poppedSet.has(item.label)
                      return (
                        <motion.li
                          key={item.label}
                          layout
                          initial={{ opacity: 0, scale: 0.6, y: -14 }}
                          animate={{ opacity: isLeaving ? 0.45 : 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                          className={cn(
                            'relative w-[74px] rounded-lg border-2 bg-white text-center shadow-sm',
                            inSwap
                              ? 'border-amber-400 ring-4 ring-amber-100'
                              : 'border-[#3B82F6]/40',
                          )}
                        >
                          <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold tabular-nums text-slate-400">
                            {i}
                          </span>
                          <p
                            className={cn(
                              'mt-2.5 truncate px-1 text-[11px] font-semibold',
                              inSwap ? 'text-amber-700' : 'text-[#0F1F46]',
                            )}
                          >
                            {item.label}
                          </p>
                          <p
                            className={cn(
                              'mb-2 text-lg font-bold tabular-nums',
                              inSwap ? 'text-amber-600' : 'text-slate-700',
                            )}
                          >
                            {formatValue(item.value)}
                          </p>
                        </motion.li>
                      )
                    })}
                  </AnimatePresence>
                </ol>
              )}
            </div>

            <div className="mt-4 border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Popped order (ascending priorities)
              </h3>
              {derived.popped.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">nothing popped yet</p>
              ) : (
                <ol className="mt-2 flex flex-wrap gap-1.5">
                  {derived.popped.map((item) => (
                     <li
                      key={`${item.label}-${item.value}`}
                      className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 tabular-nums"
                    >
                      {item.label} {formatValue(item.value)}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </CardContent>
        </Card>

        {/* (b) tree view */}
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tree view — node i&rsquo;s children are 2i+1 and 2i+2
            </h3>
            <svg
              viewBox={`0 0 ${TREE_W} ${treeHeight}`}
              className="mx-auto mt-2 h-auto w-full"
              role="img"
              aria-label="Binary heap tree view"
            >
              {derived.arr.map((item, i) => {
                const parent = Math.floor((i - 1) / 2)
                if (i === 0) return null
                const from = treePosition(parent)
                const to = treePosition(i)
                return (
                  <line
                    key={`edge-${item.label}`}
                    x1={from.x}
                    y1={from.y + NODE_R}
                    x2={to.x}
                    y2={to.y - NODE_R}
                    stroke="#CBD5E1"
                    strokeWidth={2}
                  />
                )
              })}
              {derived.arr.map((item, i) => {
                const { x, y } = treePosition(i)
                const inSwap = swapIndices.includes(i)
                const isRoot = i === 0
                const isLeaving = poppedSet.has(item.label)
                return (
                  <motion.g
                    key={item.label}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isLeaving ? 0.4 : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={NODE_R}
                      fill={inSwap ? '#FEF3C7' : isRoot ? '#3B82F6' : '#FFFFFF'}
                      stroke={inSwap ? '#F59E0B' : '#3B82F6'}
                      strokeWidth={inSwap ? 3 : 2}
                    />
                    <text
                      x={x}
                      y={y + 5}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={700}
                      fill={inSwap ? '#B45309' : isRoot ? '#FFFFFF' : '#0F1F46'}
                      pointerEvents="none"
                    >
                      {formatValue(item.value)}
                    </text>
                    <text
                      x={x}
                      y={y + NODE_R + 14}
                      textAnchor="middle"
                      fontSize={9.5}
                      fontWeight={600}
                      fill="#64748B"
                      pointerEvents="none"
                    >
                      {item.label}
                    </text>
                  </motion.g>
                )
              })}
            </svg>
          </CardContent>
        </Card>
      </div>

      <PlaybackBar playback={playback} stepLabel={step ? stepLabel(step) : 'ready'} />
    </div>
  )
}

export function HeapTab() {
  const [valuesInput, setValuesInput] = useState('')
  const [customValues, setCustomValues] = useState<number[] | null>(null)

  const { data, isPending } = useQuery({
    queryKey: ['playground-heap', customValues],
    queryFn: () =>
      apiFetch<PlaygroundHeapResponse>('/playground/heap', {
        method: 'POST',
        body: JSON.stringify(customValues ? { values: customValues } : {}),
      }),
  })

  const applyCustomValues = () => {
    const parsed = valuesInput
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n))
    if (parsed.length === 0) {
      toast({ title: 'No numbers found', description: 'Enter comma-separated numbers, e.g. 9, 4, 7, 1, 3.' })
      return
    }
    if (parsed.length > 24) {
      toast({ title: 'Too many values', description: 'The heap playground accepts up to 24 numbers.' })
      return
    }
    setCustomValues(parsed)
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-56 flex-1">
            <Label htmlFor="heap-values" className="text-xs font-semibold text-slate-600">
              Custom values (comma-separated, up to 24)
            </Label>
            <Input
              id="heap-values"
              value={valuesInput}
              onChange={(event) => setValuesInput(event.target.value)}
              placeholder="e.g. 9, 4, 7, 1, 3"
              className="mt-1.5 w-full sm:w-64"
              onKeyDown={(event) => {
                if (event.key === 'Enter') applyCustomValues()
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            onClick={applyCustomValues}
            className="h-9 rounded-lg bg-[#0F1F46] text-white hover:bg-[#1B2F5E]"
          >
            Use my values
          </Button>
          {customValues ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCustomValues(null)
                setValuesInput('')
              }}
              className="h-9 rounded-lg"
            >
              Back to real data
            </Button>
          ) : null}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            {customValues
              ? `custom mode: ${customValues.length} values`
              : 'default: every student’s connection count'}
          </div>
        </CardContent>
      </Card>

      {isPending || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      ) : (
        <HeapReplay key={customValues ? customValues.join(',') : 'default'} data={data} />
      )}
    </div>
  )
}

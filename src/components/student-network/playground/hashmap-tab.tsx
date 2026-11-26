'use client'

/**
 * Hash Map tab — replays the skill-counting pass computed by the real Python
 * HashMap: every student's skills are hashed (sum of character codes mod 8),
 * inserted into a bucket chain, then incremented on every repeat. Collisions
 * chain visually inside the bucket. State derives purely from steps[0..index].
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useMemo } from 'react'

import { PlaybackBar, usePlayback } from '@/components/student-network/playground/playback'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import type { PlaygroundHashmapResponse, PlaygroundHashmapStep } from '@/lib/types'
import { cn } from '@/lib/utils'

interface BucketEntry {
  key: string
  count: number
}

function deriveTable(steps: PlaygroundHashmapStep[], index: number) {
  const buckets: BucketEntry[][] = []
  const counts = new Map<string, number>()
  const owners = new Map<string, string>()
  for (let k = 0; k <= index; k++) {
    const step = steps[k]
    if (step.op === 'hash') {
      if (step.owner) owners.set(step.key, step.owner)
    } else if (step.op === 'insert') {
      for (let b = 0; b < step.bucket; b++) if (!buckets[b]) buckets[b] = []
      if (!buckets[step.bucket]) buckets[step.bucket] = []
      if (!buckets[step.bucket].some((entry) => entry.key === step.key)) {
        buckets[step.bucket].push({ key: step.key, count: 1 })
      }
      counts.set(step.key, 1)
    } else if (step.op === 'increment' && step.count !== undefined) {
      counts.set(step.key, step.count)
      const entry = buckets[step.bucket]?.find((item) => item.key === step.key)
      if (entry) entry.count = step.count
    }
  }
  return { buckets, counts, owners }
}

function stepLabel(step: PlaygroundHashmapStep): string {
  switch (step.op) {
    case 'hash':
      return `hash '${step.key}' → bucket ${step.bucket}`
    case 'insert':
      return `insert '${step.key}' into bucket ${step.bucket}`
    case 'increment':
      return `'${step.key}' count → ${step.count}`
  }
}

function opMessage(step: PlaygroundHashmapStep, ownerFor: string | undefined): string {
  switch (step.op) {
    case 'hash':
      return `${step.detail ?? ''} → bucket ${step.bucket}${
        ownerFor ? ` (@${ownerFor}'s skill)` : ''
      }`
    case 'insert':
      return `'${step.key}' stored in bucket ${step.bucket} with count 1${
        ownerFor ? ` — first mention by @${ownerFor}` : ''
      }`
    case 'increment':
      return `'${step.key}' seen again — count incremented to ${step.count}`
  }
}

export function HashMapTab() {
  const { data, isPending } = useQuery({
    queryKey: ['playground-hashmap'],
    queryFn: () => apiFetch<PlaygroundHashmapResponse>('/playground/hashmap'),
  })
  const playback = usePlayback(data?.steps.length ?? 1)

  const derived = useMemo(
    () => (data ? deriveTable(data.steps, playback.index) : null),
    [data, playback.index],
  )

  const ranked = useMemo(() => {
    if (!derived) return []
    return [...derived.counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )
  }, [derived])

  if (isPending || !data || !derived) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  const step = data.steps[playback.index]
  const activeBucket = step?.bucket
  const maxCount = ranked.length > 0 ? ranked[0][1] : 1
  const finished = playback.atEnd

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-[#0F1F46] text-white hover:bg-[#0F1F46]">
          capacity {data.capacity}
        </Badge>
        <Badge className="rounded-full bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
          {derived.counts.size} distinct skills
        </Badge>
        <Badge variant="outline" className="rounded-full text-slate-600">
          collisions chain inside the bucket
        </Badge>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Hash table — bucket index = sum of character codes mod {data.capacity}
          </h3>
          <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {Array.from({ length: data.capacity }, (_, bucket) => {
              const entries = derived.buckets[bucket] ?? []
              const isActive = activeBucket === bucket
              return (
                <li
                  key={bucket}
                  className={cn(
                    'flex min-h-32 flex-col rounded-lg border-2 bg-white p-2 transition-colors',
                    isActive
                      ? 'border-amber-400 ring-4 ring-amber-100'
                      : 'border-slate-200',
                  )}
                  aria-label={`Bucket ${bucket} with ${entries.length} entries`}
                >
                  <div className="mb-1.5 text-center">
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                        isActive ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-500',
                      )}
                    >
                      bucket {bucket}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5">
                    {entries.length === 0 ? (
                      <span className="m-auto text-[10px] text-slate-300">empty</span>
                    ) : (
                      entries.map((entry) => {
                        const owner = derived.owners.get(entry.key)
                        return (
                          <motion.div
                            key={entry.key}
                            initial={{ opacity: 0, y: -8, scale: 0.85 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                            className="rounded-md border border-[#3B82F6]/30 bg-blue-50/60 px-1.5 py-1"
                          >
                            <p className="truncate text-[10px] font-semibold text-[#0F1F46]" title={owner ? `@${owner}` : undefined}>
                              {entry.key}
                            </p>
                            <p className="mt-0.5 flex items-center justify-center">
                              <motion.span
                                key={entry.count}
                                initial={{ scale: 1.6, color: '#F59E0B' }}
                                animate={{ scale: 1, color: '#0F1F46' }}
                                transition={{ duration: 0.3 }}
                                className="rounded-full bg-[#0F1F46] px-1.5 text-[9px] font-bold text-white tabular-nums"
                              >
                                ×{entry.count}
                              </motion.span>
                            </p>
                          </motion.div>
                        )
                      })
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          {step ? (
            <div
              className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
              role="status"
            >
              <span className="rounded-md bg-[#0F1F46] px-2 py-0.5 text-[11px] font-bold text-white">
                {step.op}
              </span>
              <span className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {step.key}
              </span>
              <span className="text-xs text-amber-800">
                {opMessage(step, derived.owners.get(step.key))}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Skill counts so far {finished ? '(final)' : '(live while replaying)'}
            </h3>
            {ranked.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">nothing hashed yet</p>
            ) : (
              <ol className="mt-3 max-h-80 space-y-1.5 overflow-y-auto pr-2">
                {ranked.map(([key, count]) => (
                  <li key={key} className="flex items-center gap-2 text-xs">
                    <span className="w-32 shrink-0 truncate font-semibold text-[#0F1F46] sm:w-40" title={key}>
                      {key}
                    </span>
                    <span className="h-3.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <motion.span
                        className="block h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#22D3EE]"
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxCount) * 100}%` }}
                        transition={{ duration: 0.35 }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right font-bold tabular-nums text-slate-600">
                      {count}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Final table (server snapshot)
            </h3>
            <div className="mt-2 max-h-72 space-y-1 overflow-y-auto text-[11px] leading-relaxed">
              {data.table.map((bucket, i) => (
                <p key={i} className="flex gap-2 tabular-nums">
                  <span className="w-12 shrink-0 font-bold text-slate-400">{i}:</span>
                  <span className="text-slate-600">
                    {bucket.length === 0
                      ? '—'
                      : bucket.map(([key, count]) => `${key}×${count}`).join('  ·  ')}
                  </span>
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <PlaybackBar playback={playback} stepLabel={step ? stepLabel(step) : 'ready'} />
    </div>
  )
}

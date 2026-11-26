'use client'

/**
 * BFS tab — pick a source student, then replay the real breadth-first
 * traversal trace computed by the Python SocialGraph: every dequeued node,
 * its parent (the discovery edge) and the queue contents after each step.
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowRight, Play, Users } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  CircleGraph,
  type CircleEdgeVisual,
  type CircleNodeVisual,
} from '@/components/student-network/playground/circle-graph'
import { PlaybackBar, usePlayback } from '@/components/student-network/playground/playback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import type { BfsStep, BfsTraceResponse, PlaygroundGraphResponse } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

/** Fill color per BFS level; the source itself is amber. */
const LEVEL_COLORS: Record<number, string> = {
  0: '#F59E0B',
  1: '#22D3EE',
  2: '#3B82F6',
  3: '#8B5CF6',
}

const CURRENT_RING = '#F97316'
const DISCOVERY_EDGE = '#F97316'
const PLAIN_EDGE = '#CBD5E1'

function levelColor(level: number): string {
  return LEVEL_COLORS[level] ?? '#8B5CF6'
}

function BfsTraceReplay({ graph, trace }: { graph: PlaygroundGraphResponse; trace: BfsTraceResponse }) {
  const playback = usePlayback(trace.steps.length)

  const derived = useMemo(() => {
    const levelOf = new Map<string, number>()
    const discovery = new Set<string>()
    for (let k = 0; k <= playback.index; k++) {
      const step: BfsStep = trace.steps[k]
      levelOf.set(step.node, step.level)
      if (step.parent) discovery.add(`${step.parent}->${step.node}`)
    }
    const currentNode = trace.steps[playback.index]?.node ?? null

    const nodes: CircleNodeVisual[] = graph.nodes.map((node) => {
      const level = levelOf.get(node.username)
      return {
        username: node.username,
        full_name: node.full_name,
        visible: true,
        fill: level === undefined ? '#94A3B8' : levelColor(level),
        ring: node.username === currentNode ? CURRENT_RING : undefined,
        dim: level === undefined,
      }
    })

    const edges: CircleEdgeVisual[] = graph.edges.map((edge) => {
      const isDiscovery =
        discovery.has(`${edge.source}->${edge.target}`) ||
        discovery.has(`${edge.target}->${edge.source}`)
      return {
        source: edge.source,
        target: edge.target,
        visible: true,
        color: isDiscovery ? DISCOVERY_EDGE : PLAIN_EDGE,
        width: isDiscovery ? 3 : 2,
      }
    })

    return { nodes, edges, currentNode }
  }, [graph, trace, playback.index])

  const currentStep: BfsStep | undefined = trace.steps[playback.index]
  const queue = currentStep?.queue ?? []
  const finished = playback.atEnd

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="gap-1 rounded-full bg-[#0F1F46] text-white hover:bg-[#0F1F46]">
          <Users className="size-3" aria-hidden="true" />
          source: @{trace.source}
        </Badge>
        {finished ? (
          <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            {trace.reachable} students reachable from @{trace.source}
          </Badge>
        ) : (
          <Badge variant="outline" className="rounded-full text-slate-600">
            {trace.reachable} reachable when finished
          </Badge>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <CircleGraph nodes={derived.nodes} edges={derived.edges} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardContent className="p-3">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Queue (front → back)
              </h3>
              {queue.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-200 px-2 py-1.5 text-xs text-slate-400">
                  empty
                </p>
              ) : (
                <ol className="flex flex-wrap gap-1.5">
                  {queue.map((item, i) => (
                    <li
                      key={`${item}-${i}`}
                      className={cn(
                        'rounded-md px-2 py-1 text-xs font-semibold tabular-nums',
                        i === 0
                          ? 'border border-orange-300 bg-orange-100 text-orange-800'
                          : 'border border-slate-200 bg-slate-50 text-slate-600',
                      )}
                    >
                      {item}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardContent className="space-y-2 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Current step
              </h3>
              {currentStep ? (
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-[#0F1F46]">Dequeued @{currentStep.node}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-600">
                    <ArrowRight className="size-3 text-slate-400" aria-hidden="true" />
                    {currentStep.parent
                      ? `discovered from @${currentStep.parent}`
                      : 'the source (level 0)'}
                  </p>
                  <Badge
                    className="rounded-full text-white hover:opacity-90"
                    style={{ backgroundColor: levelColor(currentStep.level) }}
                  >
                    level {currentStep.level}
                  </Badge>
                </div>
              ) : null}
              <div className="mt-1 grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-[#F59E0B]" aria-hidden="true" /> source
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-[#22D3EE]" aria-hidden="true" /> level 1
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-[#3B82F6]" aria-hidden="true" /> level 2
                </span>
                <span className="flex items-center gap-1">
                  <span className="size-2.5 rounded-full bg-[#8B5CF6]" aria-hidden="true" /> level 3+
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <PlaybackBar
        playback={playback}
        stepLabel={
          currentStep ? `dequeued ${currentStep.node} (level ${currentStep.level})` : 'ready'
        }
      />
    </div>
  )
}

export function BfsTab() {
  const me = useAppStore((s) => s.me)
  const { data: graph, isPending: graphPending } = useQuery({
    queryKey: ['playground-graph'],
    queryFn: () => apiFetch<PlaygroundGraphResponse>('/playground/graph'),
  })

  const [sourceChoice, setSourceChoice] = useState<string | null>(null)
  /** Defaults to the logged-in student until another source is picked. */
  const source = sourceChoice ?? me?.username ?? ''
  const [trace, setTrace] = useState<BfsTraceResponse | null>(null)

  const runMutation = useMutation({
    mutationFn: (from: string) =>
      apiFetch<BfsTraceResponse>(`/playground/bfs?from=${encodeURIComponent(from)}`),
    onSuccess: (result) => setTrace(result),
  })

  if (graphPending || !graph) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-44 flex-1 sm:flex-none">
            <Label htmlFor="bfs-source" className="text-xs font-semibold text-slate-600">
              Source student
            </Label>
            <Select
              value={source}
              onValueChange={(value) => setSourceChoice(value)}
              disabled={runMutation.isPending}
            >
              <SelectTrigger id="bfs-source" className="mt-1.5 w-full sm:w-56">
                <SelectValue placeholder="Pick a student" />
              </SelectTrigger>
              <SelectContent>
                {graph.nodes.map((node) => (
                  <SelectItem key={node.username} value={node.username}>
                    {node.username} — {node.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => source && runMutation.mutate(source)}
            disabled={!source || runMutation.isPending}
            className="gap-2 rounded-lg bg-[#0F1F46] text-white hover:bg-[#1B2F5E]"
          >
            <Play className="size-4" aria-hidden="true" />
            {runMutation.isPending ? 'Running…' : 'Run BFS'}
          </Button>
          {trace ? (
            <p className="text-xs text-slate-500">
              Replay below — pick another source and run again to restart.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Pick a source and run BFS to get the step-by-step traversal trace.
            </p>
          )}
        </CardContent>
      </Card>

      {trace ? (
        <BfsTraceReplay key={trace.source} graph={graph} trace={trace} />
      ) : (
        <Card className="rounded-xl border border-dashed border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-medium text-[#0F1F46]">No traversal loaded yet</p>
            <p className="max-w-md text-xs text-slate-500">
              The replay shows every dequeue, the discovery edge from each node&rsquo;s parent, the
              queue after each step, and the BFS level of every student.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

'use client'

/**
 * Graph tab — replays the adjacency-list construction of the real CU.Setu
 * student graph: 20 add_vertex steps then 28 add_edge steps, exactly as the
 * Python SocialGraph implementation produced them.
 */

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import {
  CircleGraph,
  type CircleEdgeVisual,
  type CircleNodeVisual,
} from '@/components/student-network/playground/circle-graph'
import { PlaybackBar, usePlayback } from '@/components/student-network/playground/playback'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import type { PlaygroundGraphResponse } from '@/lib/types'
import { cn } from '@/lib/utils'

const NODE_FILL = '#3B82F6'
const EDGE_COLOR = '#22D3EE'

function stepText(step: PlaygroundGraphResponse['steps'][number]): string {
  if (step.op === 'add_vertex') return `Added vertex ${step.node}`
  return `Connected ${step.source} — ${step.target}`
}

export function GraphTab() {
  const { data, isPending } = useQuery({
    queryKey: ['playground-graph'],
    queryFn: () => apiFetch<PlaygroundGraphResponse>('/playground/graph'),
  })
  const playback = usePlayback(data?.steps.length ?? 1)
  const [selected, setSelected] = useState<string | null>(null)

  const derived = useMemo(() => {
    if (!data) return null
    const visibleNodes = new Set<string>()
    const visibleEdges = new Set<string>()
    for (let k = 0; k <= playback.index; k++) {
      const step = data.steps[k]
      if (step.op === 'add_vertex') visibleNodes.add(step.node)
      else visibleEdges.add(`${step.source}->${step.target}`)
    }

    const nodes: CircleNodeVisual[] = data.nodes.map((node) => ({
      username: node.username,
      full_name: node.full_name,
      visible: visibleNodes.has(node.username),
      fill: NODE_FILL,
      dim: false,
    }))

    const edges: CircleEdgeVisual[] = data.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      visible: visibleEdges.has(`${edge.source}->${edge.target}`),
      color: EDGE_COLOR,
      width: 2.5,
    }))

    return { nodes, edges }
  }, [data, playback.index])

  if (isPending || !data || !derived) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  const currentStep = data.steps[playback.index]
  const selectedNode = selected ? data.nodes.find((n) => n.username === selected) : null
  const nodesAdded = data.steps.slice(0, playback.index + 1).filter((s) => s.op === 'add_vertex').length
  const edgesAdded = data.steps.slice(0, playback.index + 1).filter((s) => s.op === 'add_edge').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-[#0F1F46] text-white hover:bg-[#0F1F46]">
          {data.stats.vertices} vertices
        </Badge>
        <Badge className="rounded-full bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
          {data.stats.edges} edges
        </Badge>
        <Badge variant="outline" className="rounded-full text-slate-600">
          shown: {nodesAdded} nodes / {edgesAdded} edges
        </Badge>
        <span className="text-xs text-slate-500">
          Nodes are the 20 students; edges are their accepted connections.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <CircleGraph
              nodes={derived.nodes}
              edges={derived.edges}
              selected={selected}
              onNodeClick={(username) =>
                setSelected((current) => (current === username ? null : username))
              }
            />
            {selectedNode ? (
              <div
                className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800"
                role="status"
              >
                <span className="font-semibold text-[#0F1F46]">@{selectedNode.username}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedNode.full_name}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold">degree {selectedNode.degree}</span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="ml-1 rounded-full px-1 text-amber-600 hover:bg-amber-100"
                  aria-label="Clear selected node"
                >
                  ×
                </button>
              </div>
            ) : (
              <p className="mt-1 text-center text-xs text-slate-500">
                Click a node to see its degree (number of connections).
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Step log
            </h3>
            <ol className="max-h-[430px] space-y-0.5 overflow-y-auto pr-1 text-xs">
              {data.steps.map((step, i) => (
                <li
                  key={i}
                  className={cn(
                    'rounded-md px-2 py-1 tabular-nums',
                    i === playback.index
                      ? 'bg-amber-100 font-semibold text-amber-900'
                      : i < playback.index
                        ? 'text-slate-600'
                        : 'text-slate-300',
                  )}
                >
                  {stepText(step)}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <PlaybackBar playback={playback} stepLabel={stepText(currentStep)} />
    </div>
  )
}

'use client'

/**
 * Trie tab — replays the real insertions (38 words: usernames + lowercase
 * full names) computed by the Python Trie, then lets you search any prefix
 * through the same live tree. All rendering derives purely from the step
 * data; the tree layout is computed once from the final structure.
 */

import { useMutation, useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { PlaybackBar, usePlayback } from '@/components/student-network/playground/playback'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import type {
  PlaygroundTrieInsertStep,
  PlaygroundTrieNode,
  PlaygroundTrieResponse,
  PlaygroundTrieSearchResponse,
} from '@/lib/types'
import { cn } from '@/lib/utils'

/* ------------------------------ tree layout ------------------------------- */

interface FlatNode {
  /** Path from the root (concatenated chars); the root itself is ''. */
  id: string
  char: string
  depth: number
  /** Horizontal slot (leaves get consecutive slots; parents centre). */
  slot: number
  owners: string[]
  parentId: string | null
}

const SLOT_W = 34
const LEVEL_H = 62
const MARGIN_X = 26
const MARGIN_TOP = 44
const MARGIN_BOTTOM = 26

function buildLayout(root: PlaygroundTrieNode) {
  const nodes: FlatNode[] = []
  const childrenOf = new Map<string, FlatNode[]>()

  const collect = (node: PlaygroundTrieNode, parentId: string | null, depth: number) => {
    const id = parentId === null ? '' : parentId + node.char
    const flatNode: FlatNode = {
      id,
      char: node.char,
      depth,
      slot: 0,
      owners: [...node.terminal],
      parentId,
    }
    nodes.push(flatNode)
    if (parentId !== null) {
      const list = childrenOf.get(parentId) ?? []
      list.push(flatNode)
      childrenOf.set(parentId, list)
    }
    for (const child of node.children) collect(child, id, depth + 1)
    return flatNode
  }

  const rootNode = collect(root, null, 0)

  let slotCursor = 0
  const assign = (node: FlatNode): number => {
    const children = childrenOf.get(node.id) ?? []
    if (children.length === 0) {
      node.slot = slotCursor++
      return 1
    }
    children.forEach((child) => assign(child))
    node.slot = (children[0].slot + children[children.length - 1].slot) / 2
    return 0
  }
  assign(rootNode)

  const maxDepth = nodes.reduce((m, n) => Math.max(m, n.depth), 0)
  return {
    nodes,
    childrenOf,
    width: slotCursor * SLOT_W + MARGIN_X * 2,
    height: (maxDepth + 1) * LEVEL_H + MARGIN_TOP + MARGIN_BOTTOM,
  }
}

/* ------------------------------- visuals ---------------------------------- */

type NodeMode = 'normal' | 'path' | 'current' | 'subtree'

const MODE_STYLES: Record<NodeMode, { fill: string; stroke: string; text: string }> = {
  normal: { fill: '#FFFFFF', stroke: '#3B82F6', text: '#0F1F46' },
  path: { fill: '#FEF3C7', stroke: '#F59E0B', text: '#92400E' },
  current: { fill: '#F59E0B', stroke: '#B45309', text: '#FFFFFF' },
  subtree: { fill: '#CFFAFE', stroke: '#06B6D4', text: '#155E75' },
}

function stepLabel(step: PlaygroundTrieInsertStep): string {
  switch (step.op) {
    case 'start_word':
      return `start "${step.word}" (@${step.owner})`
    case 'create':
      return `create '${step.char}' at index ${step.index}`
    case 'descend':
      return `descend '${step.char}' at index ${step.index}`
    case 'finish_word':
      return `"${step.word}" complete — terminal (@${step.owner})`
  }
}

export function TrieTab() {
  const { data, isPending } = useQuery({
    queryKey: ['playground-trie'],
    queryFn: () => apiFetch<PlaygroundTrieResponse>('/playground/trie'),
  })

  const playback = usePlayback(data?.steps.length ?? 1)

  const [prefixInput, setPrefixInput] = useState('')
  const [searchResult, setSearchResult] = useState<PlaygroundTrieSearchResponse | null>(null)
  const searchPlayback = usePlayback(searchResult?.steps.length ?? 1)

  const layout = useMemo(() => (data ? buildLayout(data.tree) : null), [data])

  const searchMutation = useMutation({
    mutationFn: (prefix: string) =>
      apiFetch<PlaygroundTrieSearchResponse>('/playground/trie/search', {
        method: 'POST',
        body: JSON.stringify({ prefix }),
      }),
    onSuccess: (result) => {
      // The search trace walks the FULL tree — make sure every insert has
      // been replayed before highlighting the search path. Resetting the
      // search step index here keeps a shorter new trace valid on render.
      playback.jumpToEnd()
      searchPlayback.jumpTo(0)
      setSearchResult(result)
    },
    onError: () => {
      toast({ title: 'Search failed', description: 'The trie service did not answer.' })
    },
  })

  // Auto-play the search trace once a result arrives.
  useEffect(() => {
    if (searchResult) searchPlayback.play()
  }, [searchResult])

  /* ----------------------- insert replay derivation ---------------------- */

  const insertState = useMemo(() => {
    if (!data) return null
    const visiblePaths = new Set<string>([''])
    const terminalOwners = new Map<string, string[]>()
    let activeWord: string | null = null
    let activeOwner: string | null = null
    const activePaths = new Set<string>([''])
    const step = data.steps[playback.index]

    for (let k = 0; k <= playback.index; k++) {
      const s = data.steps[k]
      if (s.op === 'start_word') {
        activeWord = s.word
        activeOwner = s.owner
        activePaths.clear()
        activePaths.add('')
      } else if (s.op === 'create' || s.op === 'descend') {
        const path = s.word.slice(0, s.index + 1)
        visiblePaths.add(path)
        activePaths.add(path)
      } else {
        const owners = terminalOwners.get(s.word) ?? []
        owners.push(s.owner)
        terminalOwners.set(s.word, owners)
      }
    }

    let currentPath: string | null = null
    if (step) {
      if (step.op === 'create' || step.op === 'descend')
        currentPath = step.word.slice(0, step.index + 1)
      else if (step.op === 'finish_word') currentPath = step.word
      else currentPath = ''
    }

    return { visiblePaths, terminalOwners, activeWord, activeOwner, activePaths, currentPath, step }
  }, [data, playback.index])

  /* ------------------------ search derivation --------------------------- */

  const searchState = useMemo(() => {
    if (!searchResult) return null
    const matched = new Set<string>()
    let currentMatch: string | null = null
    let miss: { parentPath: string; char: string } | null = null
    let collected: { prefix: string; matches: string[] } | null = null

    for (let k = 0; k <= searchPlayback.index; k++) {
      const s = searchResult.steps[k]
      if (!s) break
      if (s.op === 'match' && s.index !== undefined) {
        matched.add(searchResult.prefix.slice(0, s.index + 1))
      } else if (s.op === 'miss') {
        miss = { parentPath: searchResult.prefix.slice(0, s.index ?? 0), char: s.char ?? '?' }
      } else if (s.op === 'collect') {
        collected = { prefix: searchResult.prefix, matches: s.matches ?? [] }
      }
    }

    const s = searchResult.steps[searchPlayback.index]
    if (s?.op === 'match' && s.index !== undefined)
      currentMatch = searchResult.prefix.slice(0, s.index + 1)
    else if (s?.op === 'collect') currentMatch = searchResult.prefix

    return { matched, currentMatch, miss, collected }
  }, [searchResult, searchPlayback.index])

  const subtreeIds = useMemo(() => {
    if (!searchState?.collected || !layout) return null
    const ids = new Set<string>()
    const expand = (id: string) => {
      ids.add(id)
      for (const child of layout.childrenOf.get(id) ?? []) expand(child.id)
    }
    expand(searchState.collected.prefix)
    return ids
  }, [searchState, layout])

  if (isPending || !data || !layout || !insertState) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    )
  }

  /* ------------------------------ rendering ------------------------------ */

  const nodeMode = (node: FlatNode): NodeMode => {
    if (searchState) {
      if (searchState.currentMatch === node.id) return 'current'
      if (searchState.matched.has(node.id)) return 'path'
      if (subtreeIds?.has(node.id)) return 'subtree'
      return 'normal'
    }
    if (insertState.currentPath === node.id) return 'current'
    if (insertState.activePaths.has(node.id)) return 'path'
    return 'normal'
  }

  const { visiblePaths, terminalOwners } = insertState
  const px = (slot: number) => MARGIN_X + slot * SLOT_W
  const py = (depth: number) => MARGIN_TOP + depth * LEVEL_H

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]))
  const missParent = searchState?.miss ? nodeById.get(searchState.miss.parentPath) ?? null : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="rounded-full bg-[#0F1F46] text-white hover:bg-[#0F1F46]">
          {data.words.length} words
        </Badge>
        <Badge className="rounded-full bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
          {layout.nodes.length - 1} trie nodes
        </Badge>
        <Badge variant="outline" className="rounded-full text-slate-600">
          usernames + lowercase full names
        </Badge>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <svg
              width={layout.width}
              height={layout.height}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="mx-auto block"
              role="img"
              aria-label="Trie tree of student words"
            >
              {/* edges */}
              {layout.nodes.map((node) => {
                if (!node.parentId) return null
                if (!searchResult && !visiblePaths.has(node.id)) return null
                const parent = nodeById.get(node.parentId)
                if (!parent) return null
                if (!searchResult && !visiblePaths.has(parent.id) && parent.id !== '') return null
                const mode = nodeMode(node)
                const inPath = mode === 'path' || mode === 'current'
                return (
                  <line
                    key={`edge-${node.id}`}
                    x1={px(parent.slot)}
                    y1={py(parent.depth) + 13}
                    x2={px(node.slot)}
                    y2={py(node.depth) - 13}
                    stroke={inPath ? '#F59E0B' : mode === 'subtree' ? '#06B6D4' : '#CBD5E1'}
                    strokeWidth={inPath ? 2.5 : 1.6}
                  />
                )
              })}

              {/* nodes */}
              {layout.nodes.map((node) => {
                if (node.id !== '' && !searchResult && !visiblePaths.has(node.id)) return null
                const mode = nodeMode(node)
                const style = MODE_STYLES[mode]
                const x = px(node.slot)
                const y = py(node.depth)
                const isRoot = node.id === ''
                const owners = terminalOwners.get(node.id) ?? node.owners
                return (
                  <g key={node.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isRoot ? 14 : 12}
                      fill={isRoot ? '#0F1F46' : style.fill}
                      stroke={isRoot ? '#0F1F46' : style.stroke}
                      strokeWidth={mode === 'normal' ? 1.8 : 2.4}
                    >
                      {owners.length > 0 ? (
                        <title>{`ends: ${owners.map((o) => `@${o}`).join(', ')}`}</title>
                      ) : null}
                    </circle>
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontSize={11.5}
                      fontWeight={700}
                      fill={isRoot ? '#FFFFFF' : style.text}
                      pointerEvents="none"
                    >
                      {isRoot ? '•' : node.char}
                    </text>
                    {owners.length > 0 ? (
                      <circle cx={x + 10} cy={y - 10} r={4.5} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={1.4}>
                        <title>{`terminal — ${owners.map((o) => `@${o}`).join(', ')}`}</title>
                      </circle>
                    ) : null}
                    {isRoot ? (
                      <text
                        x={x}
                        y={y - 22}
                        textAnchor="middle"
                        fontSize={10}
                        fontWeight={600}
                        fill="#64748B"
                        pointerEvents="none"
                      >
                        root
                      </text>
                    ) : null}
                  </g>
                )
              })}

              {/* miss marker (prefix diverges here) */}
              {searchState?.miss && missParent ? (
                <g>
                  <circle
                    cx={px(missParent.slot) + 26}
                    cy={py(missParent.depth) + 30}
                    r={11}
                    fill="#FEE2E2"
                    stroke="#DC2626"
                    strokeWidth={2}
                  >
                    <title>{`no child '${searchState.miss.char}' — prefix diverges here`}</title>
                  </circle>
                  <text
                    x={px(missParent.slot) + 26}
                    y={py(missParent.depth) + 34.5}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={800}
                    fill="#DC2626"
                    pointerEvents="none"
                  >
                    ✕
                  </text>
                </g>
              ) : null}
            </svg>
          </div>

          <p className="mt-3 text-center text-xs text-slate-500">
            {searchResult
              ? searchState?.collected
                ? `Collected ${searchState.collected.matches.length} match(es) under "${searchResult.prefix}" — subtree highlighted cyan.`
                : searchState?.miss
                  ? `"${searchResult.prefix}" diverges — no child '${searchState.miss.char}' at that node.`
                  : 'Walking the prefix through the tree…'
              : insertState.activeWord
                ? `Inserting "${insertState.activeWord}" for @${insertState.activeOwner ?? '…'} — amber path shows the walk.`
                : 'Ready.'}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <PlaybackBar
          playback={playback}
          stepLabel={insertState.step ? stepLabel(insertState.step) : 'ready'}
        />

        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <Label htmlFor="trie-prefix" className="text-xs font-semibold text-slate-600">
              Search the live trie
            </Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="trie-prefix"
                value={prefixInput}
                onChange={(event) => setPrefixInput(event.target.value)}
                placeholder="e.g. an"
                className="h-9 w-32"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const value = prefixInput.trim().toLowerCase()
                    if (value) searchMutation.mutate(value)
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!prefixInput.trim() || searchMutation.isPending}
                onClick={() => searchMutation.mutate(prefixInput.trim().toLowerCase())}
                className="h-9 gap-1.5 rounded-lg bg-[#0F1F46] text-white hover:bg-[#1B2F5E]"
              >
                <Search className="size-3.5" aria-hidden="true" />
                {searchMutation.isPending ? 'Searching…' : 'Search prefix'}
              </Button>
              {searchResult ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSearchResult(null)}
                  className="h-9 gap-1 text-slate-500"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  Clear
                </Button>
              ) : null}
            </div>

            {searchResult ? (
              <div className="mt-3 space-y-3">
                <div className="rounded-lg border border-border bg-slate-50 p-2">
                  <p className="text-xs font-semibold text-[#0F1F46]">
                    Prefix &ldquo;{searchResult.prefix}&rdquo;
                  </p>
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      searchResult.matches.length ? 'text-emerald-700' : 'text-rose-600',
                    )}
                  >
                    {searchResult.matches.length > 0
                      ? `${searchResult.matches.length} student(s) found`
                      : 'no words start with this prefix'}
                  </p>
                  {searchResult.matches.length > 0 ? (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {searchResult.matches.map((match) => (
                        <li
                          key={match.username}
                          className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-800"
                        >
                          @{match.username} · {match.full_name}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <PlaybackBar
                  playback={searchPlayback}
                  stepLabel={`searching "${searchResult.prefix}"`}
                  className="border-dashed p-2.5 shadow-none"
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Searching jumps the insert replay to the end (full tree) and walks your prefix
                through it — amber path, cyan collected subtree.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

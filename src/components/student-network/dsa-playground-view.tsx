'use client'

/**
 * DSA Playground — the five course classics (graph, BFS, trie, min-heap,
 * hash map) replayed on CU.Setu's live data. Every step is computed by the
 * real Python implementations in the student-network service; this view only
 * renders the traces they return.
 */

import { FlaskConical } from 'lucide-react'

import { SectionHeader } from '@/components/student-network/section-header'
import { BfsTab } from '@/components/student-network/playground/bfs-tab'
import { GraphTab } from '@/components/student-network/playground/graph-tab'
import { HashMapTab } from '@/components/student-network/playground/hashmap-tab'
import { HeapTab } from '@/components/student-network/playground/heap-tab'
import { TrieTab } from '@/components/student-network/playground/trie-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const TABS = [
  { value: 'graph', label: 'Graph' },
  { value: 'bfs', label: 'BFS' },
  { value: 'trie', label: 'Trie' },
  { value: 'heap', label: 'Heap' },
  { value: 'hashmap', label: 'Hash Map' },
] as const

export function DsaPlaygroundView() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <SectionHeader
        title="DSA Playground"
        subtitle="The five course classics, replayed on CU.Setu's live data — every step below is computed by the real Python implementation."
        action={
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <FlaskConical className="size-4 text-[#3B82F6]" aria-hidden="true" />
            5 visualizers · live traces
          </span>
        }
      />

      <Tabs defaultValue="graph" className="w-full">
        <TabsList className="h-auto flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="px-3 py-1.5">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="graph" className="mt-4">
          <GraphTab />
        </TabsContent>
        <TabsContent value="bfs" className="mt-4">
          <BfsTab />
        </TabsContent>
        <TabsContent value="trie" className="mt-4">
          <TrieTab />
        </TabsContent>
        <TabsContent value="heap" className="mt-4">
          <HeapTab />
        </TabsContent>
        <TabsContent value="hashmap" className="mt-4">
          <HashMapTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

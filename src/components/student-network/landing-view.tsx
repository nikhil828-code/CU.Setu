'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useEffect, useState } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { StatChip } from '@/components/student-network/stat-chip'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api'
import type { StatsResponse } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function CountUp({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    let frame = 0
    const start = performance.now()
    const duration = 800
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(value * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className="tabular-nums">{display.toLocaleString()}</span>
}

const FEATURES = [
  {
    title: 'Graph-powered networking',
    description: 'Every connection is a real edge in an adjacency list. Your network is a graph — traversed, measured and queried like one.',
  },
  {
    title: 'Instant prefix search',
    description: 'Search students by name or username in milliseconds — powered by a Trie that walks character by character.',
  },
  {
    title: 'Ranked recommendations',
    description: 'People you may know, scored with Jaccard similarity, mutual connections and shared skills — selected with a bounded heap.',
  },
]

const DSA_CHIPS = ['Graph', 'BFS', 'Trie', 'Heap', 'Jaccard']

export function LandingView() {
  const goto = useAppStore((s) => s.goto)
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<StatsResponse>('/stats'),
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#0A1128] text-slate-200">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0A1128]/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-8" />
            <span className="text-lg font-semibold text-white">CampusConnect</span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Authentication">
            <Button
              variant="ghost"
              className="text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => goto('login')}
            >
              Log in
            </Button>
            <Button
              className="bg-[#101B3D] text-white hover:bg-[#182650]"
              onClick={() => goto('register')}
            >
              Sign up
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#93C5FD]">
              <span className="size-1.5 rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED]" aria-hidden="true" />
              The university network for builders
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Where university talent{' '}
              <span className="bg-gradient-to-r from-[#60A5FA] to-[#A78BFA] bg-clip-text text-transparent">
                networks.
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400">
              Share technical projects, celebrate achievements and trade ideas with
              the students who get it. Build a network that is a real graph —
              every connection an edge, every search a Trie walk, every
              recommendation a similarity score.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#2563EB] to-[#7C3AED] text-white hover:opacity-90"
                onClick={() => goto('register')}
              >
                Join CampusConnect
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={() => goto('login')}
              >
                Log in
              </Button>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
              <div>
                <dt className="sr-only">Students</dt>
                <dd className="text-2xl font-bold text-white sm:text-3xl">
                  {stats ? <CountUp value={stats.students} /> : '—'}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">Students on campus</dd>
              </div>
              <div className="border-x border-white/10 pl-3 sm:pl-4">
                <dt className="sr-only">Connections</dt>
                <dd className="text-2xl font-bold text-white sm:text-3xl">
                  {stats ? <CountUp value={stats.connections} /> : '—'}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">Connections formed</dd>
              </div>
              <div className="pl-3 sm:pl-4">
                <dt className="sr-only">Posts</dt>
                <dd className="text-2xl font-bold text-white sm:text-3xl">
                  {stats ? <CountUp value={stats.posts} /> : '—'}
                </dd>
                <dd className="mt-1 text-xs text-slate-500">Projects shared</dd>
              </div>
            </dl>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40">
            <Image
              src="/hero-network.jpg"
              alt="Abstract network graph illustration on a dark navy background"
              width={1344}
              height={768}
              priority
              className="h-auto w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A1128]/70 via-transparent to-[#0A1128]/20" />
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-white/10 bg-[#0D1530]">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Built like a system, not a feed
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Under the hood, classic data structures do all the interesting work.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <h3 className="text-base font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* DSA strip */}
        <section className="border-t border-white/10">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 py-10 sm:px-6 md:flex-row md:justify-between">
            <p className="text-sm text-slate-400">
              <span className="font-semibold text-white">Built on real DSA</span> — every
              feature is a classic algorithm at work.
            </p>
            <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Algorithms used">
              {DSA_CHIPS.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[#93C5FD]"
                >
                  {chip}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Live stats */}
        <section className="border-t border-white/10 bg-[#0D1530]">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-3 px-4 py-8 sm:grid-cols-3 sm:px-6">
            <StatChip tone="dark" label="Students" value={stats?.students ?? '—'} />
            <StatChip tone="dark" label="Connections" value={stats?.connections ?? '—'} />
            <StatChip tone="dark" label="Posts shared" value={stats?.posts ?? '—'} />
          </div>
        </section>
      </main>

      <footer className="mt-auto border-t border-white/10 bg-[#0A1128]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-6" />
            <span className="text-sm font-semibold text-white">CampusConnect</span>
            <span className="text-sm text-slate-500">· A Data Structures &amp; Algorithms mini project</span>
          </div>
          <nav className="flex items-center gap-4 text-sm text-slate-400" aria-label="Footer">
            <button type="button" className="hover:text-white" onClick={() => goto('login')}>
              Log in
            </button>
            <button type="button" className="hover:text-white" onClick={() => goto('register')}>
              Sign up
            </button>
          </nav>
        </div>
      </footer>
    </div>
  )
}

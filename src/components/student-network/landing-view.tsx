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
    description:
      'Every connection is a real edge in an adjacency list. Your network is a graph — traversed, measured and queried like one.',
  },
  {
    title: 'Instant prefix search',
    description:
      'Find any Chanakya University student by name or username in milliseconds — powered by a Trie that walks character by character.',
  },
  {
    title: 'Ranked recommendations',
    description:
      'People you may know, scored with Jaccard similarity, mutual connections and shared skills — selected with a bounded heap.',
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
          <button
            type="button"
            onClick={() => goto('landing')}
            className="flex items-center gap-2.5"
            aria-label="CU.Setu home"
          >
            <BrandMark className="h-9 w-auto" />
            <span className="text-lg font-semibold tracking-tight text-white">
              CU.<span className="text-amber-400">Setu</span>
            </span>
          </button>
          <nav className="flex items-center gap-2" aria-label="Authentication">
            <Button
              variant="ghost"
              className="text-slate-200 hover:bg-white/10 hover:text-white"
              onClick={() => goto('login')}
            >
              Log in
            </Button>
            <Button
              className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
              onClick={() => goto('register')}
            >
              Sign up
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — the Chanakya University campus as the backdrop. The sky
            stays clearly visible (light overlay) while a darker scrim
            settles around the name for readability. */}
        <section className="relative isolate flex min-h-[540px] items-center overflow-hidden sm:min-h-[600px]">
          <Image
            src="/cu-campus.jpg"
            alt="Chanakya University campus building with the Indian flag"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {/* Bottom-dark -> top-transparent: the blue sky stays visible. */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-[#050B1F]/95 via-[#0A1128]/40 to-[#0A1128]/10"
            aria-hidden="true"
          />
          {/* Extra darkness hugging the name block on the left. */}
          <div
            className="absolute inset-0 bg-[radial-gradient(58%_70%_at_27%_62%,rgba(4,9,26,0.92)_0%,rgba(4,9,26,0.55)_45%,transparent_75%)]"
            aria-hidden="true"
          />
          <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <div className="max-w-2xl">
              <BrandMark className="h-20 w-auto sm:h-24" />
              <h1 className="mt-4 text-5xl font-bold tracking-tight text-white sm:text-6xl">
                CU.<span className="text-amber-400">Setu</span>
              </h1>
              <p className="mt-3 text-lg font-medium text-slate-200 sm:text-xl">
                A bridge connecting the students of Chanakya University.
              </p>
              <p className="mt-1.5 text-sm font-medium tracking-wide text-amber-300/90">
                Connect · Share · Grow
              </p>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                Share technical projects, celebrate achievements and trade ideas
                with the students who get it. Build a network that is a real
                graph — every connection an edge, every search a Trie walk,
                every recommendation a similarity score.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-lg shadow-orange-950/40 hover:from-amber-600 hover:to-orange-700"
                  onClick={() => goto('register')}
                >
                  Join CU.Setu
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20 hover:text-white"
                  onClick={() => goto('login')}
                >
                  Log in
                </Button>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-3 rounded-2xl border border-white/10 bg-[#0A1128]/60 p-4 backdrop-blur-sm sm:gap-4">
                <div>
                  <dt className="sr-only">Students</dt>
                  <dd className="text-2xl font-bold text-white sm:text-3xl">
                    {stats ? <CountUp value={stats.students} /> : '—'}
                  </dd>
                  <dd className="mt-1 text-xs text-slate-300">Students on campus</dd>
                </div>
                <div className="border-x border-white/10 pl-3 sm:pl-4">
                  <dt className="sr-only">Connections</dt>
                  <dd className="text-2xl font-bold text-white sm:text-3xl">
                    {stats ? <CountUp value={stats.connections} /> : '—'}
                  </dd>
                  <dd className="mt-1 text-xs text-slate-300">Connections formed</dd>
                </div>
                <div className="pl-3 sm:pl-4">
                  <dt className="sr-only">Posts</dt>
                  <dd className="text-2xl font-bold text-white sm:text-3xl">
                    {stats ? <CountUp value={stats.posts} /> : '—'}
                  </dd>
                  <dd className="mt-1 text-xs text-slate-300">Projects shared</dd>
                </div>
              </dl>
            </div>
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
                  className="rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-amber-500/40 hover:bg-white/[0.07]"
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
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
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
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-auto" />
            <div>
              <p className="text-sm font-semibold text-white">
                CU.<span className="text-amber-400">Setu</span>
              </p>
              <p className="text-xs text-slate-500">
                A bridge connecting the students of Chanakya University · A Data
                Structures &amp; Algorithms mini project
              </p>
            </div>
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

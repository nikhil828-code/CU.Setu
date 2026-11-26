'use client'

/**
 * Campus Skill Analytics — a live census of the skills listed on real
 * CU.Setu profiles.
 *
 * The Flask backend counts skill mentions through a hash map and ranks the
 * leaders with a heap:
 *   GET /api/analytics/skills                -> campus totals, heap-ranked top list,
 *                                               programme and year splits
 *   GET /api/analytics/skills/students      -> students who list a given skill
 *   GET /api/analytics/skills/complementary -> skills co-listed with a given
 *                                               skill (set co-occurrence ranking)
 * This view only renders those numbers — nothing is hardcoded.
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  BarChart3,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  SearchX,
  Shapes,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { StatChip } from '@/components/student-network/stat-chip'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import type {
  ComplementarySkillsResponse,
  SkillAnalyticsResponse,
  SkillCountItem,
  SkillStudentsResponse,
  UserSummary,
} from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

/* -------------------------------- helpers ----------------------------------- */

function normalizeSkill(raw: string): string {
  return raw.trim().toLowerCase()
}

function errText(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

function pctLabel(value: number): string {
  return `${value.toFixed(1)}%`
}

function LoadingNote({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-orange-600" aria-hidden="true" />
      {label}
    </p>
  )
}

/* ------------------------------ small pieces --------------------------------- */

function SkillChip({
  skill,
  onClick,
  ariaLabel,
}: {
  skill: string
  onClick: () => void
  ariaLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium capitalize text-slate-700 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
      aria-label={ariaLabel}
    >
      {skill}
    </button>
  )
}

function StudentChip({ student }: { student: UserSummary }) {
  const openProfile = useAppStore((s) => s.openProfile)
  return (
    <button
      type="button"
      onClick={() => openProfile(student.username)}
      className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-1"
      aria-label={`Open ${student.full_name}'s profile`}
    >
      <UserAvatar
        username={student.username}
        fullName={student.full_name}
        avatarUrl={student.avatar_url}
        size="sm"
      />
      <span className="min-w-0 text-left">
        <span className="block truncate text-sm font-medium leading-tight text-slate-900">
          {student.full_name}
        </span>
        <span className="block truncate text-[11px] leading-tight text-muted-foreground">
          {student.programme} · {student.year}
        </span>
      </span>
    </button>
  )
}

/** One group card for the Programme / Year splits (proportional Tailwind bars). */
function GroupCard({ name, items }: { name: string; items: SkillCountItem[] }) {
  const peak = Math.max(...items.map((item) => item.count), 1)
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="truncate text-sm font-semibold text-foreground">{name}</h4>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {items.length} {items.length === 1 ? 'skill' : 'skills'}
        </span>
      </div>
      <ul className="thin-scrollbar mt-3 max-h-80 space-y-3 overflow-y-auto pr-1">
        {items.map((item) => (
          <li key={item.skill}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium capitalize text-slate-700">{item.skill}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{item.count}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-600"
                style={{ width: `${Math.max((item.count / peak) * 100, 6)}%` }}
                aria-hidden="true"
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Recharts tooltip body — skill, count and share of campus. */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: SkillCountItem }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]?.payload
  if (!item) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold capitalize text-slate-900">{item.skill}</p>
      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
        {item.count} {item.count === 1 ? 'student' : 'students'} ·{' '}
        {pctLabel(item.pct ?? 0)} of campus
      </p>
    </div>
  )
}

/* ------------------------------ loading / error ------------------------------- */

function AnalyticsSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading campus skill analytics"
    >
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
        <Skeleton className="h-16 rounded-lg" />
      </div>
      <Skeleton className="h-[500px] rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  )
}

/* --------------------------------- the view ---------------------------------- */

export function SkillAnalyticsView() {
  const [skillInput, setSkillInput] = useState('')
  const [peopleSkill, setPeopleSkill] = useState<string | null>(null)
  const [pairInput, setPairInput] = useState('')
  const [pairSkill, setPairSkill] = useState<string | null>(null)

  const analyticsQuery = useQuery({
    queryKey: ['skill-analytics'],
    queryFn: () => apiFetch<SkillAnalyticsResponse>('/analytics/skills'),
  })

  const peopleQuery = useQuery({
    queryKey: ['skill-students', peopleSkill],
    queryFn: () =>
      apiFetch<SkillStudentsResponse>(
        `/analytics/skills/students?skill=${encodeURIComponent(peopleSkill ?? '')}`,
      ),
    enabled: peopleSkill !== null,
  })

  const pairQuery = useQuery({
    queryKey: ['skill-complementary', pairSkill],
    queryFn: () =>
      apiFetch<ComplementarySkillsResponse>(
        `/analytics/skills/complementary?skill=${encodeURIComponent(pairSkill ?? '')}`,
      ),
    enabled: pairSkill !== null,
  })

  // Unknown skills come back as 404 — surface the server message as a toast
  // (the friendly inline empty state renders below it).
  useEffect(() => {
    if (peopleQuery.error instanceof ApiError) {
      toast({ title: 'Skill not found', description: peopleQuery.error.message })
    }
  }, [peopleQuery.error])

  useEffect(() => {
    if (pairQuery.error instanceof ApiError) {
      toast({ title: 'Skill not found', description: pairQuery.error.message })
    }
  }, [pairQuery.error])

  const runPeopleSearch = (skill: string) => {
    const clean = normalizeSkill(skill)
    if (clean === '') return
    setSkillInput(clean)
    setPeopleSkill(clean)
  }

  const runPairSearch = (skill: string) => {
    const clean = normalizeSkill(skill)
    if (clean === '') return
    setPairInput(clean)
    setPairSkill(clean)
  }

  if (analyticsQuery.isPending) return <AnalyticsSkeleton />

  if (analyticsQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <SectionHeader title="Campus Skill Analytics" />
        <EmptyState
          icon={AlertTriangle}
          title="Could not load the skill census"
          description={errText(
            analyticsQuery.error,
            'The campus skill analytics service is unreachable right now.',
          )}
          action={
            <Button onClick={() => analyticsQuery.refetch()} className="gap-1.5">
              <RefreshCw className="size-4" aria-hidden="true" />
              Try again
            </Button>
          }
        />
      </div>
    )
  }

  const data = analyticsQuery.data
  const top = data.top
  const programmeGroups = Object.entries(data.by_programme).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  const yearGroups = Object.entries(data.by_year)

  /* -------- people-search result block -------- */
  let peopleResult: React.ReactNode = null
  if (peopleSkill !== null) {
    if (peopleQuery.isPending) {
      peopleResult = <LoadingNote label={`Scanning profiles for “${peopleSkill}”…`} />
    } else if (peopleQuery.isError) {
      peopleResult = (
        <EmptyState
          icon={SearchX}
          title={`Nobody on campus lists “${peopleSkill}” yet`}
          description={errText(peopleQuery.error, 'No student on campus has that skill yet.')}
        />
      )
    } else if ((peopleQuery.data?.students.length ?? 0) === 0) {
      peopleResult = (
        <EmptyState
          icon={SearchX}
          title={`Nobody on campus lists “${peopleSkill}” yet`}
          description="No student on campus has that skill yet — try one of the popular chips above."
        />
      )
    } else if (peopleQuery.data) {
      peopleResult = (
        <div>
          <p className="text-sm font-medium text-foreground">
            <span className="tabular-nums">{peopleQuery.data.students.length}</span>{' '}
            {peopleQuery.data.students.length === 1 ? 'student knows' : 'students know'}{' '}
            <span className="capitalize text-orange-700">{peopleSkill}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {peopleQuery.data.students.map((student) => (
              <StudentChip key={student.username} student={student} />
            ))}
          </div>
        </div>
      )
    }
  }

  /* -------- complementary-skills result block -------- */
  let pairResult: React.ReactNode = null
  if (pairSkill !== null) {
    if (pairQuery.isPending) {
      pairResult = <LoadingNote label={`Ranking co-listed skills for “${pairSkill}”…`} />
    } else if (pairQuery.isError) {
      pairResult = (
        <EmptyState
          icon={SearchX}
          title={`Nobody on campus knows “${pairSkill}” yet`}
          description={errText(pairQuery.error, 'No student on campus has that skill yet.')}
        />
      )
    } else if ((pairQuery.data?.complementary.length ?? 0) === 0) {
      pairResult = (
        <EmptyState
          icon={SearchX}
          title={`Nothing pairs with “${pairSkill}” yet`}
          description="Students who list that skill have not listed anything else in common so far."
        />
      )
    } else if (pairQuery.data) {
      pairResult = (
        <div>
          <p className="text-sm font-medium text-foreground">
            {pairQuery.data.complementary.length}{' '}
            {pairQuery.data.complementary.length === 1 ? 'skill pairs' : 'skills pair'} with{' '}
            <span className="capitalize text-orange-700">{pairSkill}</span>
          </p>
          <ul className="mt-3 divide-y divide-border">
            {pairQuery.data.complementary.map((item) => (
              <li key={item.skill} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium capitalize text-slate-800">
                    {item.skill}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {item.count} of {item.of_owners} {item.of_owners === 1 ? 'owner' : 'owners'} ·{' '}
                    {pctLabel(item.pct)}
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-600"
                    style={{ width: `${Math.max(item.pct, 3)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-6"
      >
        <SectionHeader
          title="Campus Skill Analytics"
          subtitle="A live census of real campus profiles — skills counted through a hash map, heap-ranked leaders, programme and year splits, and set co-occurrence pairing."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => analyticsQuery.refetch()}
              disabled={analyticsQuery.isFetching}
              className="gap-1.5"
            >
              <RefreshCw
                className={cn('size-3.5', analyticsQuery.isFetching && 'animate-spin')}
                aria-hidden="true"
              />
              Refresh
            </Button>
          }
        />

        {/* Stat chips row */}
        <div className="grid grid-cols-3 gap-3" aria-label="Campus skill census totals">
          <StatChip icon={Users} label="students" value={data.students} />
          <StatChip icon={Shapes} label="distinct skills" value={data.distinct_skills} />
          <StatChip icon={ListChecks} label="skill listings" value={data.total_listings} />
        </div>

        {/* Top skills chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-orange-600" aria-hidden="true" />
              Top skills on campus
            </CardTitle>
            <CardDescription>
              The heap-ranked leaders across {data.students} students — tap a bar to find the
              people behind it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="h-[430px] w-full"
              role="img"
              aria-label="Horizontal bar chart of the top twelve campus skills with student counts"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={top}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="skillBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FBBF24" />
                      <stop offset="100%" stopColor="#EA580C" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="4 4" />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fill: '#64748B', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="skill"
                    width={88}
                    tick={{ fill: '#334155', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickFormatter={(value: string) =>
                      value.length > 16 ? `${value.slice(0, 15)}…` : value
                    }
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(234, 88, 12, 0.07)' }}
                    content={({ active, payload }) => (
                      <ChartTooltip active={active} payload={payload} />
                    )}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#skillBarGradient)"
                    radius={[0, 6, 6, 0]}
                    barSize={22}
                    className="cursor-pointer"
                    onClick={(bar: unknown) => {
                      const item = (bar as { payload?: SkillCountItem } | null | undefined)?.payload
                      if (item?.skill) runPeopleSearch(item.skill)
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Programme / Year splits */}
        <Card>
          <CardHeader>
            <CardTitle>Where the skills cluster</CardTitle>
            <CardDescription>
              Hash-map counts grouped by programme and by year — the bars scale to each
              group&apos;s own leader.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="programme">
              <TabsList className="grid w-full grid-cols-2 sm:w-fit">
                <TabsTrigger value="programme">Programme</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
              <TabsContent value="programme" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {programmeGroups.map(([name, items]) => (
                    <GroupCard key={name} name={name} items={items} />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="year" className="mt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {yearGroups.map(([name, items]) => (
                    <GroupCard key={name} name={name} items={items} />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Find people by skill */}
        <Card>
          <CardHeader>
            <CardTitle>Find people by skill</CardTitle>
            <CardDescription>
              Each lookup is one hash-map hit — search any skill to see who lists it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                runPeopleSearch(skillInput)
              }}
            >
              <Input
                value={skillInput}
                onChange={(event) => setSkillInput(event.target.value)}
                placeholder="Search a skill, e.g. python"
                aria-label="Skill to search students by"
                className="sm:max-w-sm"
              />
              <Button type="submit" className="gap-1.5 sm:w-fit">
                <Search className="size-4" aria-hidden="true" />
                Find people
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Popular:</span>
              {top.slice(0, 8).map((item) => (
                <SkillChip
                  key={item.skill}
                  skill={item.skill}
                  onClick={() => runPeopleSearch(item.skill)}
                  ariaLabel={`Find students who know ${item.skill}`}
                />
              ))}
            </div>
            {peopleResult}
          </CardContent>
        </Card>

        {/* Complementary skills */}
        <Card>
          <CardHeader>
            <CardTitle>Complementary skills</CardTitle>
            <CardDescription>
              {pairSkill
                ? `Skills that students who know ${pairSkill} also list — set co-occurrence ranking.`
                : 'What pairs with React? Skills that students who know a skill also list — set co-occurrence ranking.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault()
                runPairSearch(pairInput)
              }}
            >
              <Input
                value={pairInput}
                onChange={(event) => setPairInput(event.target.value)}
                placeholder="What pairs with React?"
                aria-label="Skill to find complementary skills for"
                className="sm:max-w-sm"
              />
              <Button type="submit" variant="outline" className="gap-1.5 sm:w-fit">
                <Layers className="size-4" aria-hidden="true" />
                Find pairs
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Try:</span>
              {top.slice(0, 6).map((item) => (
                <SkillChip
                  key={item.skill}
                  skill={item.skill}
                  onClick={() => runPairSearch(item.skill)}
                  ariaLabel={`Find skills that pair with ${item.skill}`}
                />
              ))}
            </div>
            {pairResult}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

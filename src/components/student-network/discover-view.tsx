'use client'

/**
 * Smart People Discovery 2.0 — weighted compatibility ranking.
 *
 * The backend (`/api/discovery`) computes four Jaccard-based factors
 * (mutual connections / shared skills / shared interests / same major)
 * with configurable weights and ranks candidates with a bounded top-K
 * heap. This view only renders that real result — nothing is hardcoded.
 */

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { RotateCcw, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { useState } from 'react'

import { ConnectButton } from '@/components/student-network/connect-button'
import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { apiFetch } from '@/lib/api'
import { gradientFor } from '@/lib/avatar'
import type { DiscoveryRecommendation } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

const DEFAULT_WEIGHTS = { mutual: 40, skills: 30, interests: 20, major: 10 }

const FACTOR_META = {
  mutual: { label: 'Mutual friends', color: '#22D3EE' },
  skills: { label: 'Shared skills', color: '#3B82F6' },
  interests: { label: 'Shared interests', color: '#0D9488' },
  major: { label: 'Same major', color: '#FB923C' },
} as const

type WeightKey = keyof typeof DEFAULT_WEIGHTS

type Weights = Record<WeightKey, number>

function weightParams(weights: Weights): string {
  const params = new URLSearchParams({
    w_mutual: String(weights.mutual),
    w_skills: String(weights.skills),
    w_interests: String(weights.interests),
    w_major: String(weights.major),
    limit: '12',
  })
  return params.toString()
}

function DiscoverCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-5 w-40 rounded-full" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-8 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

function CompatibilityBar({ person, weights }: { person: DiscoveryRecommendation; weights: Weights }) {
  const total = weights.mutual + weights.skills + weights.interests + weights.major || 1
  const contributions = (Object.keys(FACTOR_META) as WeightKey[]).map((key) => ({
    key,
    width: ((weights[key] / total) * person.factors[key]) * 100,
  }))
  const compat = Math.round(person.compatibility * 100)

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Compatibility</span>
        <span className="font-semibold tabular-nums text-foreground">{compat}%</span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-muted">
        {contributions
          .filter((c) => c.width > 0.4)
          .map((c) => (
            <Tooltip key={c.key}>
              <TooltipTrigger asChild>
                <span
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${c.width}%`, background: FACTOR_META[c.key].color }}
                  aria-label={`${FACTOR_META[c.key].label}: ${Math.round(c.width)}% contribution`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {FACTOR_META[c.key].label}: {Math.round(c.width)}% of the score
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {(Object.keys(FACTOR_META) as WeightKey[]).map((key) => (
          <span key={key} className="flex items-center gap-1">
            <span
              className="size-1.5 rounded-full"
              style={{ background: FACTOR_META[key].color }}
              aria-hidden="true"
            />
            {Math.round(person.factors[key] * 100)}% {FACTOR_META[key].label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  )
}

function RecommendationCard({
  person,
  weights,
}: {
  person: DiscoveryRecommendation
  weights: Weights
}) {
  const openProfile = useAppStore((s) => s.openProfile)

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="h-full">
      <Card
        className="h-full cursor-pointer shadow-sm transition-shadow hover:shadow-md"
        onClick={() => openProfile(person.username)}
      >
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start gap-3">
            <UserAvatar
              username={person.username}
              fullName={person.full_name}
              avatarUrl={person.avatar_url}
              size="lg"
              onClick={() => openProfile(person.username)}
            />
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => openProfile(person.username)}
                className="block truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {person.full_name}
              </button>
              <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {person.programme || 'Student'}
                {person.year ? ` · ${person.year}` : ''}
              </p>
            </div>
          </div>

          {person.mutual_count > 0 && person.mutual_names.length > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {person.mutual_names.slice(0, 4).map((name) => (
                  <Tooltip key={name}>
                    <TooltipTrigger asChild>
                      <span
                        className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white ring-2 ring-white"
                        style={{ background: gradientFor(name) }}
                        aria-hidden="true"
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>@{name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {person.mutual_count} mutual connection{person.mutual_count === 1 ? '' : 's'}
              </p>
            </div>
          ) : null}

          {person.shared_skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {person.shared_skills.slice(0, 4).map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                >
                  {skill}
                </Badge>
              ))}
              {person.shared_skills.length > 4 ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  +{person.shared_skills.length - 4}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {person.shared_interests.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {person.shared_interests.slice(0, 3).map((interest) => (
                <Badge
                  key={interest}
                  variant="outline"
                  className="border-teal-200 bg-teal-50 font-medium text-teal-700"
                >
                  {interest}
                </Badge>
              ))}
              {person.shared_interests.length > 3 ? (
                <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">
                  +{person.shared_interests.length - 3}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto pt-4">
            <CompatibilityBar person={person} weights={weights} />
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <ConnectButton
                username={person.username}
                relationship={person.relationship}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function DiscoverView() {
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)

  const discoveryQuery = useQuery({
    queryKey: ['discovery', weights],
    queryFn: () =>
      apiFetch<{ recommendations: DiscoveryRecommendation[] }>(
        `/discovery?${weightParams(weights)}`,
      ),
  })

  const recommendations = discoveryQuery.data?.recommendations ?? []
  const totalWeight =
    weights.mutual + weights.skills + weights.interests + weights.major || 1

  const setWeight = (key: WeightKey, value: number) =>
    setWeights((prev) => ({ ...prev, [key]: value }))

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <SectionHeader
        title="Discover — Smart People Discovery"
        subtitle="Compatibility ranking computed live from the graph: Jaccard similarity on mutual friends, skills, interests and major — tuned by your weights, sorted with a heap."
      />

      {/* Weight controls */}
      <Card className="mb-5 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-orange-600" aria-hidden="true" />
            <h3 className="text-sm font-semibold">Tune what matters to you</h3>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 gap-1.5 text-xs text-muted-foreground"
              onClick={() => setWeights(DEFAULT_WEIGHTS)}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Reset
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            The four factors are re-computed on the server (Jaccard similarity + heap
            top-K) and re-ranked every time you release a slider. Weights are normalised
            to a percentage of their total.
          </p>
          <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {(Object.keys(FACTOR_META) as WeightKey[]).map((key) => (
              <div key={key}>
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor={`w-${key}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-foreground"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: FACTOR_META[key].color }}
                      aria-hidden="true"
                    />
                    {FACTOR_META[key].label}
                  </Label>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {Math.round((weights[key] / totalWeight) * 100)}%
                  </span>
                </div>
                <Slider
                  id={`w-${key}`}
                  className="mt-2"
                  value={[weights[key]]}
                  min={0}
                  max={100}
                  step={5}
                  onValueCommit={(v) => setWeight(key, v[0] ?? weights[key])}
                  aria-label={`${FACTOR_META[key].label} weight`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {discoveryQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <DiscoverCardSkeleton key={i} />
          ))}
        </div>
      ) : discoveryQuery.isError ? (
        <EmptyState
          icon={Sparkles}
          title="Could not load suggestions"
          description="The recommendation engine could not be reached. Please refresh and try again."
        />
      ) : recommendations.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No suggestions for now"
          description="You are already connected to everyone eligible — or requests are pending with the rest."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommendations.map((person) => (
            <RecommendationCard key={person.username} person={person} weights={weights} />
          ))}
        </div>
      )}
    </div>
  )
}

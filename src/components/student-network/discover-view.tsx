'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Compass, Sparkles, Users } from 'lucide-react'

import { ConnectButton } from '@/components/student-network/connect-button'
import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { apiFetch } from '@/lib/api'
import { gradientFor } from '@/lib/avatar'
import type { Recommendation } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

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

function RecommendationCard({
  person,
  maxScore,
}: {
  person: Recommendation
  maxScore: number
}) {
  const openProfile = useAppStore((s) => s.openProfile)
  const matchPercent = maxScore > 0 ? Math.round((person.score / maxScore) * 100) : 0

  const reasons: string[] = []
  if (person.mutual_count > 0) {
    reasons.push(
      `${person.mutual_count} mutual connection${person.mutual_count === 1 ? '' : 's'}`,
    )
  }
  if (person.same_programme) reasons.push('Same programme')
  if (person.same_year) reasons.push('Same year')

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="h-full"
    >
      <Card
        className="h-full cursor-pointer shadow-sm transition-shadow hover:shadow-md"
        onClick={() => openProfile(person.username)}
      >
        <CardContent className="flex h-full flex-col p-4">
          <div className="flex items-start gap-3">
            <UserAvatar
              username={person.username}
              fullName={person.full_name}
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

          {reasons.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {reasons.map((reason) => (
                <Badge
                  key={reason}
                  variant="outline"
                  className="font-medium text-muted-foreground"
                >
                  {reason}
                </Badge>
              ))}
            </div>
          ) : null}

          {person.mutual_names.length > 0 ? (
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
              <p className="text-xs text-muted-foreground">via mutual connections</p>
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
                  className="border-violet-200 bg-violet-50 font-medium text-violet-700"
                >
                  {interest}
                </Badge>
              ))}
              {person.shared_interests.length > 3 ? (
                <Badge
                  variant="outline"
                  className="border-violet-200 bg-violet-50 text-violet-700"
                >
                  +{person.shared_interests.length - 3}
                </Badge>
              ) : null}
            </div>
          ) : null}

          <div className="mt-auto pt-4">
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Match score</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {person.score.toFixed(1)}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2563EB] to-[#7C3AED]"
                  style={{ width: `${matchPercent}%` }}
                />
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
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
  const discoverQuery = useQuery({
    queryKey: ['recommendations', 'grid', 8],
    queryFn: () => apiFetch<{ recommendations: Recommendation[] }>('/recommendations?limit=8'),
  })

  const recommendations = discoverQuery.data?.recommendations ?? []
  const maxScore =
    recommendations.length > 0
      ? Math.max(...recommendations.map((person) => person.score))
      : 0

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <SectionHeader
        title="Discover"
        subtitle="People you may know — ranked by Jaccard similarity, mutual connections and shared skills."
      />

      {discoverQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <DiscoverCardSkeleton key={i} />
          ))}
        </div>
      ) : discoverQuery.isError ? (
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
            <RecommendationCard key={person.username} person={person} maxScore={maxScore} />
          ))}
        </div>
      )}
    </div>
  )
}

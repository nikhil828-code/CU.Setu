'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Compass, Network, Rss, Users } from 'lucide-react'

import { EmptyState } from '@/components/student-network/empty-state'
import { PostCard, PostCardSkeleton } from '@/components/student-network/post-card'
import { PostComposer } from '@/components/student-network/post-composer'
import { SectionHeader } from '@/components/student-network/section-header'
import { ConnectButton } from '@/components/student-network/connect-button'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import type {
  ConnectionItem,
  Post,
  Recommendation,
  StatsResponse,
} from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function RailSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export function FeedView() {
  const goto = useAppStore((s) => s.goto)
  const openProfile = useAppStore((s) => s.openProfile)

  const feedQuery = useQuery({
    queryKey: ['feed'],
    queryFn: () => apiFetch<{ posts: Post[] }>('/feed'),
  })

  const railQuery = useQuery({
    queryKey: ['recommendations', 'rail', 4],
    queryFn: () => apiFetch<{ recommendations: Recommendation[] }>('/recommendations?limit=4'),
  })

  const statsQuery = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiFetch<StatsResponse>('/stats'),
  })

  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: () => apiFetch<{ connections: ConnectionItem[] }>('/connections'),
  })

  const posts = feedQuery.data?.posts ?? []
  const recommendations = railQuery.data?.recommendations ?? []

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-6">
        {/* Main column */}
        <div className="min-w-0 space-y-4">
          <PostComposer />

          {feedQuery.isLoading ? (
            <>
              <PostCardSkeleton />
              <PostCardSkeleton />
              <PostCardSkeleton />
            </>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Rss}
              title="Your feed is quiet"
              description="Follow more students to fill it up — posts from you and your connections appear here."
              action={
                <Button
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                  onClick={() => goto('discover')}
                >
                  <Compass aria-hidden="true" />
                  Discover students
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3) }}
                >
                  <PostCard post={post} />
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <aside className="hidden space-y-4 xl:block" aria-label="Sidebar extras">
          {railQuery.isLoading ? (
            <RailSkeleton />
          ) : recommendations.length > 0 ? (
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Compass className="size-4 text-orange-600" aria-hidden="true" />
                  People you may know
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {recommendations.map((person) => (
                  <div
                    key={person.username}
                    className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-muted/60"
                  >
                    <UserAvatar
                      username={person.username}
                      fullName={person.full_name}
                      avatarUrl={person.avatar_url}
                      onClick={() => openProfile(person.username)}
                    />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => openProfile(person.username)}
                        className="block w-full truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
                      >
                        {person.full_name}
                      </button>
                      <p className="truncate text-xs text-muted-foreground">
                        {person.mutual_count > 0
                          ? `${person.mutual_count} mutual connection${person.mutual_count === 1 ? '' : 's'}`
                          : person.programme || 'Student'}
                      </p>
                    </div>
                    <ConnectButton
                      username={person.username}
                      relationship={person.relationship}
                      size="sm"
                    />
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 w-full text-muted-foreground hover:text-foreground"
                  onClick={() => goto('discover')}
                >
                  See all suggestions
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Network className="size-4 text-orange-600" aria-hidden="true" />
                Live platform stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ) : statsQuery.data ? (
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Students</dt>
                    <dd className="font-semibold tabular-nums">{statsQuery.data.students}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Connections</dt>
                    <dd className="font-semibold tabular-nums">{statsQuery.data.connections}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Posts</dt>
                    <dd className="font-semibold tabular-nums">{statsQuery.data.posts}</dd>
                  </div>
                </dl>
              ) : null}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/10 to-amber-500/10">
                <Users className="size-5 text-orange-600" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {connectionsQuery.isLoading
                    ? '…'
                    : `${connectionsQuery.data?.connections.length ?? 0} connections`}
                </p>
                <p className="text-xs text-muted-foreground">Your direct network</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-orange-600 hover:text-orange-700"
                onClick={() => goto('connections')}
              >
                View
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

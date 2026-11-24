'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  ArrowLeft,
  Camera,
  CalendarDays,
  Layers,
  Loader2,
  Pencil,
  Route,
  Sparkles,
  UserX,
  Users,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { ConnectButton } from '@/components/student-network/connect-button'
import { EditProfileDialog } from '@/components/student-network/edit-profile-dialog'
import { EmptyState } from '@/components/student-network/empty-state'
import { PostCard, PostCardSkeleton } from '@/components/student-network/post-card'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { apiFetch, apiUpload, mediaSrc } from '@/lib/api'
import { gradientFor } from '@/lib/avatar'
import { invalidateNetwork } from '@/lib/invalidate'
import { fullDate } from '@/lib/time'
import type { PathResponse, Post, ProfileResponse, UserSummary } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden shadow-sm">
        <Skeleton className="h-28 w-full rounded-none" />
        <CardContent className="pb-6">
          <Skeleton className="-mt-10 size-24 rounded-full ring-4 ring-white" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="mt-4 flex gap-6">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-3/4" />
        </CardContent>
      </Card>
    </div>
  )
}

function PathChain({ path, distance }: { path: string[]; distance: number }) {
  const me = useAppStore((s) => s.me)
  const openProfile = useAppStore((s) => s.openProfile)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        {path.map((username, index) => (
          <div key={username} className="flex items-center gap-x-1">
            {index > 0 ? (
              <ArrowRight
                className="mx-1 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => openProfile(username)}
                  className="flex items-center gap-2 rounded-full border bg-white py-1 pl-1 pr-3 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
                >
                  <UserAvatar username={username} size="sm" />
                  <span className="text-sm font-medium text-foreground">
                    {me && username === me.username
                      ? 'You'
                      : username.charAt(0).toUpperCase() + username.slice(1)}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>@{username}</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {distance === 1 ? '1 hop away' : `${distance} hops away`} — shortest path by BFS
      </p>
    </div>
  )
}

export function ProfileView() {
  const me = useAppStore((s) => s.me)
  const setMe = useAppStore((s) => s.setMe)
  const target = useAppStore((s) => s.profileTarget) ?? me?.username ?? ''
  const goto = useAppStore((s) => s.goto)
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const isSelf = me !== null && target === me.username

  // Profile photo / profile background uploads (own profile only).
  const photoMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('photo', file)
      return apiUpload<{ user: UserSummary }>('/profile/photo', form)
    },
    onSuccess: ({ user }) => {
      setMe(user)
      invalidateNetwork(queryClient)
      toast({ title: 'Profile photo updated', description: 'Looking good!' })
    },
    onError: (error) => {
      toast({
        title: 'Could not update profile photo',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Please try a different image.',
        variant: 'destructive',
      })
    },
  })

  const coverMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('cover', file)
      return apiUpload<{ user: UserSummary }>('/profile/cover', form)
    },
    onSuccess: ({ user }) => {
      setMe(user)
      invalidateNetwork(queryClient)
      toast({ title: 'Profile background updated', description: 'Your banner is live.' })
    },
    onError: (error) => {
      toast({
        title: 'Could not update profile background',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Please try a different image.',
        variant: 'destructive',
      })
    },
  })

  const onPickPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // allow re-selecting the same file later
    if (file) photoMutation.mutate(file)
  }

  const onPickCover = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) coverMutation.mutate(file)
  }

  const userQuery = useQuery({
    queryKey: ['user', target],
    queryFn: () =>
      apiFetch<{ user: ProfileResponse }>(`/users/${target}`),
    enabled: target !== '',
    retry: false,
  })

  const postsQuery = useQuery({
    queryKey: ['user-posts', target],
    queryFn: () => apiFetch<{ posts: Post[] }>(`/users/${target}/posts`),
    enabled: target !== '' && !userQuery.isError,
  })

  const pathQuery = useQuery({
    queryKey: ['path', target],
    queryFn: () => apiFetch<PathResponse>(`/connections/path/${target}`),
    enabled: target !== '' && !isSelf && !userQuery.isError,
    retry: false,
  })

  if (target === '') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={UserX}
          title="No profile selected"
          description="Head back to your feed and open a student profile."
          action={
            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700" onClick={() => goto('feed')}>
              Back to feed
            </Button>
          }
        />
      </div>
    )
  }

  if (userQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <ProfileSkeleton />
      </div>
    )
  }

  if (userQuery.isError || !userQuery.data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <EmptyState
          icon={UserX}
          title="Student not found"
          description="This account does not exist on CU.Setu anymore."
          action={
            <Button className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700" onClick={() => goto('feed')}>
              <ArrowLeft aria-hidden="true" />
              Back to feed
            </Button>
          }
        />
      </div>
    )
  }

  const user = userQuery.data.user
  const posts = postsQuery.data?.posts ?? []
  const path = pathQuery.data?.path ?? null

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-4"
      >
        {/* Header card */}
        <Card className="overflow-hidden shadow-sm">
          <div className="relative">
            {user.cover_url ? (
               
              <img
                src={mediaSrc(user.cover_url)}
                alt={`${user.full_name}'s profile background`}
                className="h-28 w-full object-cover sm:h-36"
              />
            ) : (
              <div
                className="h-28 w-full sm:h-36"
                style={{ background: gradientFor(user.username) }}
                aria-hidden="true"
              />
            )}
            {isSelf ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={coverMutation.isPending}
                onClick={() => coverInputRef.current?.click()}
                className="absolute right-3 top-3 h-8 gap-1.5 rounded-full bg-black/55 px-3 text-xs text-white shadow-md backdrop-blur hover:bg-black/70"
                aria-label="Upload profile background"
              >
                {coverMutation.isPending ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Camera className="size-3.5" aria-hidden="true" />
                )}
                {user.cover_url ? 'Change background' : 'Add background'}
              </Button>
            ) : null}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickCover}
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>
          <CardContent className="pb-6">
            <div className="flex items-end justify-between gap-4">
              <div className="relative">
                <UserAvatar
                  username={user.username}
                  fullName={user.full_name}
                  avatarUrl={user.avatar_url}
                  size="xl"
                  className="-mt-12 bg-white ring-4 ring-white"
                />
                {isSelf ? (
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={photoMutation.isPending}
                    className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:opacity-70"
                    aria-label="Upload profile photo"
                    title="Change profile photo"
                  >
                    {photoMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Camera className="size-4" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickPhoto}
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>
              <div className="pb-1">
                {isSelf ? (
                  <Button
                    variant="outline"
                    onClick={() => setEditOpen(true)}
                    className="gap-2"
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                    Edit profile
                  </Button>
                ) : (
                  <ConnectButton
                    username={user.username}
                    relationship={user.relationship}
                  />
                )}
              </div>
            </div>

            <div className="mt-4">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {user.full_name}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">@{user.username}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {user.programme ? (
                  <Badge variant="secondary" className="gap-1.5 font-medium">
                    <Layers className="size-3" aria-hidden="true" />
                    {user.programme}
                  </Badge>
                ) : null}
                {user.year ? (
                  <Badge
                    variant="outline"
                    className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                  >
                    {user.year}
                  </Badge>
                ) : null}
                {user.created_at ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="gap-1.5 font-medium text-muted-foreground">
                        <CalendarDays className="size-3" aria-hidden="true" />
                        Joined {fullDate(user.created_at).split(',')[0] ?? ''}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Joined {fullDate(user.created_at)}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              {user.bio ? (
                <p className="mt-3 text-sm leading-relaxed text-foreground">{user.bio}</p>
              ) : null}
            </div>

            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-center gap-2">
                <dt className="text-xs text-muted-foreground">Connections</dt>
                <dd className="text-sm font-semibold tabular-nums">
                  {user.connections_count}
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <dt className="text-xs text-muted-foreground">Posts</dt>
                <dd className="text-sm font-semibold tabular-nums">{user.posts_count}</dd>
              </div>
              {!isSelf ? (
                <div className="flex items-center gap-2">
                  <dt className="text-xs text-muted-foreground">Mutual</dt>
                  <dd className="text-sm font-semibold tabular-nums">
                    {user.mutual_count}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        {/* BFS connection path */}
        {!isSelf && user.relationship !== 'connected' ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Route className="size-4 text-orange-600" aria-hidden="true" />
                Connection path
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pathQuery.isLoading ? (
                <div className="flex items-center gap-2">
                  <Skeleton className="size-8 rounded-full" />
                  <Skeleton className="size-4 w-4" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                  <Skeleton className="size-4 w-4" />
                  <Skeleton className="h-8 w-24 rounded-full" />
                </div>
              ) : path && pathQuery.data && pathQuery.data.distance !== null ? (
                <PathChain path={path} distance={pathQuery.data.distance} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No path yet — beyond your network.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* Mutual connections strip */}
        {!isSelf && user.mutual.length > 0 ? (
          <Card className="shadow-sm">
            <CardContent className="flex items-center gap-4 p-4">
              <Users className="size-4 shrink-0 text-orange-600" aria-hidden="true" />
              <div className="flex flex-1 flex-wrap items-center gap-3">
                {user.mutual.map((mutual) => (
                  <Tooltip key={mutual.username}>
                    <TooltipTrigger asChild>
                      <UserAvatar
                        username={mutual.username}
                        fullName={mutual.full_name}
                        avatarUrl={mutual.avatar_url}
                        onClick={() => openProfile(mutual.username)}
                      />
                    </TooltipTrigger>
                    <TooltipContent>{mutual.full_name}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {user.mutual_count} mutual connection{user.mutual_count === 1 ? '' : 's'}
              </p>
            </CardContent>
          </Card>
        ) : null}

        {/* Skills + interests */}
        {user.skills.length > 0 || user.interests.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {user.skills.length > 0 ? (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Skills</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {user.skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="outline"
                      className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                    >
                      {skill}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ) : null}
            {user.interests.length > 0 ? (
              <Card className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">Interests</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {user.interests.map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                    >
                      {interest}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* Posts */}
        <section aria-label={`Posts by ${user.full_name}`}>
          <SectionHeader
            title="Posts"
            subtitle={`Everything ${isSelf ? 'you' : user.full_name.split(' ')[0]} shared on CU.Setu`}
          />
          {postsQuery.isLoading ? (
            <div className="space-y-4">
              <PostCardSkeleton />
              <PostCardSkeleton />
            </div>
          ) : posts.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No posts yet"
              description={
                isSelf
                  ? 'Share your first project or achievement from the feed.'
                  : `${user.full_name.split(' ')[0]} has not posted anything yet.`
              }
              action={
                isSelf ? (
                  <Button
                    className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                    onClick={() => goto('feed')}
                  >
                    Go to feed
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>
      </motion.div>

      {isSelf ? <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} /> : null}
    </div>
  )
}

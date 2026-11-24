'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ChevronDown, Network, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'

import { ConnectButton } from '@/components/student-network/connect-button'
import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { StatChip } from '@/components/student-network/stat-chip'
import { UserAvatar } from '@/components/student-network/user-avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import type { ConnectionItem, DegreesResponse, Relationship, UserSummary } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function ConnectionsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DegreeSection({
  title,
  count,
  users,
  relationshipFor,
}: {
  title: string
  count: number
  users: UserSummary[]
  relationshipFor: (username: string) => Relationship
}) {
  const openProfile = useAppStore((s) => s.openProfile)
  const [open, setOpen] = useState(false)

  if (count === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border bg-white">
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500">
          <span className="text-sm font-semibold">{title}</span>
          <Badge variant="secondary" className="tabular-nums">{count}</Badge>
          <ChevronDown
            className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="thin-scrollbar max-h-72 overflow-y-auto border-t p-2">
            {users.map((user) => (
              <li key={user.username}>
                <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60">
                  <UserAvatar
                    username={user.username}
                    fullName={user.full_name}
                    avatarUrl={user.avatar_url}
                    onClick={() => openProfile(user.username)}
                  />
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openProfile(user.username)}
                      className="block truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
                    >
                      {user.full_name}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.programme || 'Student'}
                      {user.year ? ` · ${user.year}` : ''}
                    </p>
                  </div>
                  <ConnectButton
                    username={user.username}
                    relationship={relationshipFor(user.username)}
                    size="sm"
                  />
                </div>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function ConnectionsView() {
  const openProfile = useAppStore((s) => s.openProfile)
  const goto = useAppStore((s) => s.goto)
  const queryClient = useQueryClient()
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)

  const connectionsQuery = useQuery({
    queryKey: ['connections'],
    queryFn: () => apiFetch<{ connections: ConnectionItem[] }>('/connections'),
  })

  const degreesQuery = useQuery({
    queryKey: ['degrees'],
    queryFn: () => apiFetch<DegreesResponse>('/degrees'),
  })

  const requestsQuery = useQuery({
    queryKey: ['requests'],
    queryFn: () => apiFetch<{ received: unknown[]; sent: unknown[] }>('/requests'),
  })

  const removeMutation = useMutation({
    mutationFn: (username: string) =>
      apiFetch<{ removed: string }>(`/connections/${username}`, { method: 'DELETE' }),
    onSuccess: (data) => {
      invalidateNetwork(queryClient)
      setRemoveTarget(null)
      toast({
        title: 'Connection removed',
        description: `@${data.removed} is no longer in your network.`,
      })
    },
    onError: () => {
      toast({
        title: 'Could not remove connection',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      })
    },
  })

  const relationshipFor = (username: string): Relationship => {
    const received = (requestsQuery.data?.received ?? []) as { sender: { username: string } }[]
    const sent = (requestsQuery.data?.sent ?? []) as { receiver: { username: string } }[]
    if (sent.some((item) => item.receiver.username === username)) return 'pending_out'
    if (received.some((item) => item.sender.username === username)) return 'pending_in'
    return 'none'
  }

  const connections = connectionsQuery.data?.connections ?? []
  const degrees = degreesQuery.data

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SectionHeader
          title="My network"
          subtitle="Students you are directly connected to — your first-degree neighbours in the graph."
        />

        {/* Degrees summary */}
        <Card className="mb-6 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Network className="size-4 text-orange-600" aria-hidden="true" />
              Degrees of separation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {degreesQuery.isLoading ? (
              <div className="grid gap-3 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : degrees ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatChip label="1st degree" value={degrees.counts.first} />
                  <StatChip label="2nd degree" value={degrees.counts.second} />
                  <StatChip label="3rd degree" value={degrees.counts.third} />
                  <StatChip label="Beyond" value={degrees.counts.beyond} />
                </div>
                <p className="text-xs text-muted-foreground">
                  BFS level buckets — 2nd and 3rd degree students are friends of friends.
                </p>
                <div className="space-y-2">
                  <DegreeSection
                    title="2nd degree"
                    count={degrees.counts.second}
                    users={degrees.lists.second}
                    relationshipFor={relationshipFor}
                  />
                  <DegreeSection
                    title="3rd degree"
                    count={degrees.counts.third}
                    users={degrees.lists.third}
                    relationshipFor={relationshipFor}
                  />
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Connections grid */}
        {connectionsQuery.isLoading ? (
          <ConnectionsSkeleton />
        ) : connections.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No connections yet"
            description="Your first edge is waiting — discover students you may know and send a request."
            action={
              <Button
                className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                onClick={() => goto('discover')}
              >
                Discover students
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {connections.map((connection, index) => (
              <motion.div
                key={connection.username}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card className="h-full shadow-sm transition-shadow hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-4">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        username={connection.username}
                        fullName={connection.full_name}
                        avatarUrl={connection.avatar_url}
                        onClick={() => openProfile(connection.username)}
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openProfile(connection.username)}
                          className="block truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {connection.full_name}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          @{connection.username}
                        </p>
                        {connection.programme || connection.year ? (
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {connection.programme}
                            {connection.year ? ` · ${connection.year}` : ''}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {connection.mutual_count} mutual connection
                      {connection.mutual_count === 1 ? '' : 's'}
                    </p>
                    <div className="mt-auto flex items-center gap-2 pt-4">
                      <Button
                        size="sm"
                        className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                        onClick={() => openProfile(connection.username)}
                      >
                        View profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setRemoveTarget(connection.username)}
                        aria-label={`Remove connection with ${connection.full_name}`}
                      >
                        <UserMinus className="size-4" aria-hidden="true" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        <AlertDialog
          open={removeTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRemoveTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove connection?</AlertDialogTitle>
              <AlertDialogDescription>
                {removeTarget ? `@${removeTarget}` : 'This student'} will be removed from
                your network. You can always connect again later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => removeTarget && removeMutation.mutate(removeTarget)}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {removeMutation.isPending ? 'Removing…' : 'Remove'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </div>
  )
}

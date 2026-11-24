'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Check, Inbox, SendHorizonal, X } from 'lucide-react'

import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import { timeAgo } from '@/lib/time'
import type { RequestItem, SentRequestItem } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function RequestSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-8 w-20 rounded-md" />
      </CardContent>
    </Card>
  )
}

export function RequestsView() {
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()

  const requestsQuery = useQuery({
    queryKey: ['requests'],
    queryFn: () => apiFetch<{ received: RequestItem[]; sent: SentRequestItem[] }>('/requests'),
  })

  const acceptMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ connected_with: string }>(`/requests/${id}/accept`, { method: 'POST' }),
    onSuccess: (data) => {
      invalidateNetwork(queryClient)
      toast({
        title: 'Connected',
        description: `You are now connected with @${data.connected_with}.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not accept request',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ rejected: string }>(`/requests/${id}/reject`, { method: 'POST' }),
    onSuccess: (data) => {
      invalidateNetwork(queryClient)
      toast({ title: 'Request rejected', description: `@${data.rejected}'s request was removed.` })
    },
    onError: (error) => {
      toast({
        title: 'Could not reject request',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ cancelled: string }>(`/requests/${id}/cancel`, { method: 'POST' }),
    onSuccess: (data) => {
      invalidateNetwork(queryClient)
      toast({ title: 'Request cancelled', description: `@${data.cancelled} was not notified.` })
    },
    onError: (error) => {
      toast({
        title: 'Could not cancel request',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const received = requestsQuery.data?.received ?? []
  const sent = requestsQuery.data?.sent ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SectionHeader
          title="Requests"
          subtitle="Directed edges waiting to become undirected connections."
        />

        {requestsQuery.isLoading ? (
          <div className="space-y-3">
            <RequestSkeleton />
            <RequestSkeleton />
          </div>
        ) : (
          <Tabs defaultValue="received">
            <TabsList className="mb-3">
              <TabsTrigger value="received">
                Received
                {received.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-[#2563EB] px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
                    {received.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="sent">
                Sent
                {sent.length > 0 ? (
                  <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                    {sent.length}
                  </span>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="received" className="mt-0 space-y-3">
              {received.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title="No pending requests"
                  description="When a student sends you a connection request, it will land here."
                />
              ) : (
                received.map((request) => (
                  <Card key={request.id} className="shadow-sm">
                    <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                      <UserAvatar
                        username={request.sender.username}
                        fullName={request.sender.full_name}
                        onClick={() => openProfile(request.sender.username)}
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openProfile(request.sender.username)}
                          className="block truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {request.sender.full_name}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          @{request.sender.username}
                          {request.sender.programme ? ` · ${request.sender.programme}` : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Sent {timeAgo(request.created_at)}
                        </p>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => openProfile(request.sender.username)}
                        >
                          View profile
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 bg-[#101B3D] text-white hover:bg-[#182650] sm:flex-none"
                          onClick={() => acceptMutation.mutate(request.id)}
                          disabled={acceptMutation.isPending}
                        >
                          <Check aria-hidden="true" />
                          {acceptMutation.isPending ? 'Accepting…' : 'Accept'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
                          onClick={() => rejectMutation.mutate(request.id)}
                          disabled={rejectMutation.isPending}
                        >
                          <X aria-hidden="true" />
                          {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="sent" className="mt-0 space-y-3">
              {sent.length === 0 ? (
                <EmptyState
                  icon={SendHorizonal}
                  title="No sent requests"
                  description="Requests you send will appear here until they are accepted or rejected."
                />
              ) : (
                sent.map((request) => (
                  <Card key={request.id} className="shadow-sm">
                    <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                      <UserAvatar
                        username={request.receiver.username}
                        fullName={request.receiver.full_name}
                        onClick={() => openProfile(request.receiver.username)}
                      />
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => openProfile(request.receiver.username)}
                          className="block truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
                        >
                          {request.receiver.full_name}
                        </button>
                        <p className="truncate text-xs text-muted-foreground">
                          @{request.receiver.username}
                          {request.receiver.programme
                            ? ` · ${request.receiver.programme}`
                            : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Sent {timeAgo(request.created_at)} · waiting for a reply
                        </p>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => openProfile(request.receiver.username)}
                        >
                          View profile
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 sm:flex-none"
                          onClick={() => cancelMutation.mutate(request.id)}
                          disabled={cancelMutation.isPending}
                        >
                          {cancelMutation.isPending ? 'Cancelling…' : 'Cancel request'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </motion.div>
    </div>
  )
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Clock, MessageSquare, MoreHorizontal, UserMinus, UserPlus, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import type { Relationship, RequestItem, SentRequestItem } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ConnectButtonProps {
  username: string
  relationship: Relationship
  size?: 'sm' | 'default'
  className?: string
}

function describeError(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
}

/**
 * The shared relationship action — renders the right controls for every
 * relationship state and performs the corresponding graph mutation.
 */
export function ConnectButton({
  username,
  relationship,
  size = 'default',
  className,
}: ConnectButtonProps) {
  const queryClient = useQueryClient()
  const [removeOpen, setRemoveOpen] = useState(false)

  const sendMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; status: string }>('/requests', {
        method: 'POST',
        body: JSON.stringify({ username }),
      }),
    onSuccess: () => {
      invalidateNetwork(queryClient)
      toast({ title: 'Request sent', description: `@${username} will be notified.` })
    },
    onError: (error) => {
      toast({
        title: 'Could not send request',
        description: describeError(error),
        variant: 'destructive',
      })
    },
  })

  // Needed to resolve the pending request id when viewing a profile.
  const { data: requests } = useQuery({
    queryKey: ['requests'],
    queryFn: () => apiFetch<{ received: RequestItem[]; sent: SentRequestItem[] }>('/requests'),
    enabled: relationship === 'pending_in',
  })
  const pendingId =
    requests?.received.find((item) => item.sender.username === username)?.id ?? null

  const acceptMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ connected_with: string }>(`/requests/${id}/accept`, { method: 'POST' }),
    onSuccess: (data) => {
      invalidateNetwork(queryClient)
      toast({
        title: 'Connected',
        description: `You are now connected with @${data.connected_with ?? username}.`,
      })
    },
    onError: (error) => {
      toast({ title: 'Could not accept request', description: describeError(error), variant: 'destructive' })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ rejected: string }>(`/requests/${id}/reject`, { method: 'POST' }),
    onSuccess: () => {
      invalidateNetwork(queryClient)
      toast({ title: 'Request rejected', description: `@${username}'s request was removed.` })
    },
    onError: (error) => {
      toast({ title: 'Could not reject request', description: describeError(error), variant: 'destructive' })
    },
  })

  const removeMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ removed: string }>(`/connections/${username}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateNetwork(queryClient)
      toast({ title: 'Connection removed', description: `@${username} is no longer in your network.` })
    },
    onError: (error) => {
      toast({ title: 'Could not remove connection', description: describeError(error), variant: 'destructive' })
    },
  })

  if (relationship === 'self') return null

  if (relationship === 'none') {
    return (
      <Button
        size={size}
        onClick={() => sendMutation.mutate()}
        disabled={sendMutation.isPending}
        className={cn('bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700', className)}
      >
        <UserPlus aria-hidden="true" />
        {sendMutation.isPending ? 'Sending…' : 'Connect'}
      </Button>
    )
  }

  if (relationship === 'pending_out') {
    return (
      <Button variant="outline" size={size} disabled className={className}>
        <Clock aria-hidden="true" />
        Pending
      </Button>
    )
  }

  if (relationship === 'pending_in') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Button
          size={size}
          onClick={() => pendingId && acceptMutation.mutate(pendingId)}
          disabled={pendingId === null || acceptMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
        >
          <Check aria-hidden="true" />
          {acceptMutation.isPending ? 'Accepting…' : 'Accept'}
        </Button>
        <Button
          variant="outline"
          size={size}
          onClick={() => pendingId && rejectMutation.mutate(pendingId)}
          disabled={pendingId === null || rejectMutation.isPending}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <X aria-hidden="true" />
          {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
    )
  }

  // connected
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button variant="outline" size={size} disabled className={className}>
        <MessageSquare aria-hidden="true" />
        Message
      </Button>
      <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`More options for @${username}`}
              className="size-9"
            >
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => setRemoveOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              <UserMinus aria-hidden="true" />
              Remove connection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove connection?</AlertDialogTitle>
            <AlertDialogDescription>
              @${username} will be removed from your network. You can always connect
              again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeMutation.mutate()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

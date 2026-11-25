'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BellOff,
  CheckCheck,
  CheckCircle2,
  Heart,
  MessageCircle,
  UserPlus,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import { timeAgo } from '@/lib/time'
import type { NotificationItem, NotificationKind } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

const KIND_META: Record<
  NotificationKind,
  { icon: LucideIcon; className: string; label: string }
> = {
  request_received: { icon: UserPlus, className: 'bg-blue-100 text-blue-600', label: 'Connection request' },
  request_accepted: {
    icon: CheckCircle2,
    className: 'bg-emerald-100 text-emerald-600',
    label: 'Request accepted',
  },
  request_rejected: { icon: XCircle, className: 'bg-rose-100 text-rose-600', label: 'Request rejected' },
  post_liked: { icon: Heart, className: 'bg-rose-100 text-rose-600', label: 'Post liked' },
  post_commented: {
    icon: MessageCircle,
    className: 'bg-orange-100 text-orange-600',
    label: 'New comment',
  },
  comment_liked: { icon: Heart, className: 'bg-amber-100 text-amber-600', label: 'Comment liked' },
  comment_replied: {
    icon: MessageCircle,
    className: 'bg-violet-100 text-violet-600',
    label: 'Reply to comment',
  },
}

function NotificationSkeleton() {
  return (
    <Card className="shadow-sm">
      <div className="flex items-center gap-3 p-4">
        <Skeleton className="size-9 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
    </Card>
  )
}

export function NotificationsView() {
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiFetch<{ notifications: NotificationItem[]; unread: number }>('/notifications'),
  })

  const readAllMutation = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      toast({ title: 'All caught up', description: 'Every notification is now marked as read.' })
    },
    onError: () => {
      toast({
        title: 'Could not mark as read',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      })
    },
  })

  const notifications = notificationsQuery.data?.notifications ?? []
  const unread = notificationsQuery.data?.unread ?? 0

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <SectionHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'You are all caught up'}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => readAllMutation.mutate()}
            disabled={unread === 0 || readAllMutation.isPending}
          >
            <CheckCheck aria-hidden="true" />
            {readAllMutation.isPending ? 'Marking…' : 'Mark all as read'}
          </Button>
        }
      />

      {notificationsQuery.isLoading ? (
        <div className="space-y-3">
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="Nothing here yet"
          description="Likes, comments and connection activity will show up in this feed."
        />
      ) : (
        <ul className="space-y-2.5">
          {notifications.map((notification, index) => {
            const meta = KIND_META[notification.kind]
            const Icon = meta.icon
            return (
              <motion.li
                key={notification.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3) }}
              >
                <Card
                  className={cn(
                    'shadow-sm transition-colors',
                    !notification.is_read && 'bg-accent/60',
                  )}
                >
                  <div className="flex items-center gap-3 p-4">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full',
                        meta.className,
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    {notification.actor ? (
                      <UserAvatar
                        username={notification.actor.username}
                        fullName={notification.actor.full_name}
                        avatarUrl={notification.actor.avatar_url}
                        size="sm"
                        outline={!notification.is_read}
                        onClick={() => openProfile(notification.actor?.username ?? '')}
                      />
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {notification.message}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(notification.created_at)}
                      </p>
                    </div>
                    {!notification.is_read ? (
                      <span
                        className="size-2 shrink-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-600"
                        aria-label="Unread"
                      />
                    ) : null}
                  </div>
                </Card>
              </motion.li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

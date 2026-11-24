'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { useState } from 'react'

import { UserAvatar } from '@/components/student-network/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import type { Post } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

const POST_LIMIT = 1000

export function PostComposer() {
  const me = useAppStore((s) => s.me)
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ post: Post }>('/posts', {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      }),
    onSuccess: () => {
      invalidateNetwork(queryClient)
      setContent('')
      toast({ title: 'Posted', description: 'Your update is live on the feed.' })
    },
    onError: (error) => {
      toast({
        title: 'Could not publish',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  if (!me) return null

  const tooLong = content.length > POST_LIMIT
  const canSubmit = content.trim().length > 0 && !tooLong && !createMutation.isPending

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3">
          <UserAvatar username={me.username} fullName={me.full_name} />
          <div className="min-w-0 flex-1">
            <Textarea
              placeholder="Share a project, idea or achievement…"
              rows={3}
              className="resize-none border-0 bg-muted/40 px-3 focus-visible:bg-white focus-visible:ring-1"
              aria-label="Write a post"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={POST_LIMIT + 100}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Visible to you and your connections
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    tooLong ? 'font-medium text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {content.length}/{POST_LIMIT}
                </span>
                <Button
                  size="sm"
                  onClick={() => createMutation.mutate()}
                  disabled={!canSubmit}
                  className="bg-[#101B3D] text-white hover:bg-[#182650]"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Send aria-hidden="true" />
                  )}
                  {createMutation.isPending ? 'Posting…' : 'Post'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Film,
  ImageIcon,
  Loader2,
  Send,
  X,
} from 'lucide-react'
import { useRef, useState } from 'react'

import { UserAvatar } from '@/components/student-network/user-avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { apiUpload } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import type { Post } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

const POST_LIMIT = 1000
/** Matches the backend limit (config.MAX_MEDIA_BYTES). */
const MEDIA_LIMIT = 25 * 1024 * 1024

interface PickedMedia {
  file: File
  previewUrl: string
  kind: 'image' | 'video'
}

export function PostComposer() {
  const me = useAppStore((s) => s.me)
  const queryClient = useQueryClient()
  const [content, setContent] = useState('')
  const [picked, setPicked] = useState<PickedMedia | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createMutation = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('content', content.trim())
      if (picked) form.append('media', picked.file)
      return apiUpload<{ post: Post }>('/posts', form)
    },
    onSuccess: () => {
      invalidateNetwork(queryClient)
      setContent('')
      clearPicked()
      toast({ title: 'Posted', description: 'Your update is live on the feed.' })
    },
    onError: (error) => {
      toast({
        title: 'Could not publish',
        description:
          error instanceof Error && error.message
            ? error.message
            : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  function clearPicked() {
    if (picked) URL.revokeObjectURL(picked.previewUrl)
    setPicked(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function pickMedia(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MEDIA_LIMIT) {
      toast({
        title: 'File too large',
        description: 'Photos and videos are limited to 25 MB.',
        variant: 'destructive',
      })
      return
    }
    const kind = file.type.startsWith('video/') ? 'video' : 'image'
    if (picked) URL.revokeObjectURL(picked.previewUrl)
    setPicked({ file, previewUrl: URL.createObjectURL(file), kind })
  }

  if (!me) return null

  const tooLong = content.length > POST_LIMIT
  const canSubmit =
    (content.trim().length > 0 || picked !== null) &&
    !tooLong &&
    !createMutation.isPending

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex gap-3">
          <UserAvatar
            username={me.username}
            fullName={me.full_name}
            avatarUrl={me.avatar_url}
          />
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

            {/* Attached photo / video preview */}
            {picked ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border bg-muted/40 p-2">
                {picked.kind === 'image' ? (
                   
                  <img
                    src={picked.previewUrl}
                    alt="Selected attachment preview"
                    className="size-14 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-md bg-black/80 text-white">
                    <Film className="size-6" aria-hidden="true" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {picked.file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {picked.kind === 'video' ? 'Video' : 'Photo'} ·{' '}
                    {(picked.file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={clearPicked}
                  disabled={createMutation.isPending}
                  aria-label="Remove attachment"
                >
                  <X className="size-4" aria-hidden="true" />
                </Button>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="hidden text-xs text-muted-foreground sm:block">
                Visible to you and your connections
              </p>
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Photo / video attachment */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={pickMedia}
                  aria-hidden="true"
                  tabIndex={-1}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={createMutation.isPending}
                  className={cn(
                    'gap-1.5 rounded-full text-muted-foreground hover:text-orange-600',
                    picked && 'text-orange-600',
                  )}
                  aria-label={
                    picked ? 'Replace photo or video' : 'Attach a photo or video'
                  }
                >
                  <ImageIcon className="size-4" aria-hidden="true" />
                  <Film className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Photo/Video</span>
                </Button>

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
                  className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
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

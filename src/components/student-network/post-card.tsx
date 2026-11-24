'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Heart,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Send,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'

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
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch, mediaSrc } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import { timeAgo, fullDate } from '@/lib/time'
import type { Post, PostComment } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

function updatePostLists(
  queryClient: ReturnType<typeof useQueryClient>,
  postId: number,
  updater: (post: Post) => Post,
) {
  const roots = ['feed', 'user-posts']
  for (const root of roots) {
    // Cached data for these roots is the { posts: Post[] } envelope from
    // /api/feed and /api/users/:username/posts — unwrap before mapping.
    queryClient.setQueriesData<{ posts: Post[] }>({ queryKey: [root] }, (data) =>
      data && Array.isArray(data.posts)
        ? {
            ...data,
            posts: data.posts.map((post) => (post.id === postId ? updater(post) : post)),
          }
        : data,
    )
  }
}

function updateComment(
  post: Post,
  commentId: number,
  updater: (comment: PostComment) => PostComment,
): Post {
  return {
    ...post,
    comments: post.comments.map((comment) =>
      comment.id === commentId ? updater(comment) : comment,
    ),
  }
}

/** One comment row with its own like button (optimistic toggle). */
function CommentRow({ post, comment }: { post: Post; comment: PostComment }) {
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()

  const commentLikeMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ liked: boolean; likes: number }>(`/comments/${comment.id}/like`, {
        method: 'POST',
      }),
    onMutate: () => {
      updatePostLists(queryClient, post.id, (p) =>
        updateComment(p, comment.id, (c) => ({
          ...c,
          liked_by_me: !c.liked_by_me,
          likes: c.likes + (c.liked_by_me ? -1 : 1),
        })),
      )
    },
    onSettled: () => {
      invalidateNetwork(queryClient)
    },
  })

  return (
    <li className="flex gap-2.5">
      <UserAvatar
        username={comment.author.username}
        fullName={comment.author.full_name}
        avatarUrl={comment.author.avatar_url}
        size="sm"
        onClick={() => openProfile(comment.author.username)}
      />
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-black/[0.03]">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <button
              type="button"
              onClick={() => openProfile(comment.author.username)}
              className="text-xs font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {comment.author.full_name}
            </button>
            <span
              className="text-[11px] text-muted-foreground"
              title={fullDate(comment.created_at)}
            >
              {timeAgo(comment.created_at)}
            </span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
            {comment.content}
          </p>
        </div>
        {/* Like-comment button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => commentLikeMutation.mutate()}
          disabled={commentLikeMutation.isPending}
          aria-pressed={comment.liked_by_me}
          className={cn(
            'mt-0.5 h-6 gap-1 rounded-full px-2 text-[11px] text-muted-foreground hover:text-foreground',
            comment.liked_by_me && 'text-rose-500 hover:text-rose-600',
          )}
        >
          <Heart
            className={cn('size-3', comment.liked_by_me && 'fill-rose-500')}
            aria-hidden="true"
          />
          {comment.likes > 0 ? <span className="tabular-nums">{comment.likes}</span> : 'Like'}
          <span className="sr-only">
            {comment.liked_by_me ? 'You liked this comment' : 'Like this comment'}
          </span>
        </Button>
      </div>
    </li>
  )
}

export function PostCard({ post }: { post: Post }) {
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()
  const [showComments, setShowComments] = useState(false)
  const [commentDraft, setCommentDraft] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const likeMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ liked: boolean; likes: number }>(`/posts/${post.id}/like`, {
        method: 'POST',
      }),
    onMutate: () => {
      // Optimistic toggle, rolled back by the refetch on settle.
      updatePostLists(queryClient, post.id, (p) => ({
        ...p,
        liked_by_me: !p.liked_by_me,
        likes: p.likes + (p.liked_by_me ? -1 : 1),
      }))
    },
    onSettled: () => {
      invalidateNetwork(queryClient)
    },
  })

  const commentMutation = useMutation({
    mutationFn: (content: string) =>
      apiFetch<{ comment: PostComment }>(`/posts/${post.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      }),
    onSuccess: ({ comment }) => {
      setCommentDraft('')
      updatePostLists(queryClient, post.id, (p) => ({
        ...p,
        comments: [...p.comments, comment],
      }))
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['user-posts'] })
    },
    onError: (error) => {
      toast({
        title: 'Could not add comment',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ deleted: number }>(`/posts/${post.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateNetwork(queryClient)
      toast({ title: 'Post deleted', description: 'It is no longer on the feed.' })
    },
    onError: (error) => {
      toast({
        title: 'Could not delete post',
        description:
          error instanceof ApiError ? error.message : 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    },
  })

  const submitComment = () => {
    const content = commentDraft.trim()
    if (content === '' || commentMutation.isPending) return
    commentMutation.mutate(content)
  }

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <UserAvatar
            username={post.author.username}
            fullName={post.author.full_name}
            avatarUrl={post.author.avatar_url}
            onClick={() => openProfile(post.author.username)}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <button
                type="button"
                onClick={() => openProfile(post.author.username)}
                className="truncate text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
              >
                {post.author.full_name}
              </button>
              <p className="truncate text-xs text-muted-foreground">
                {post.author.programme || 'Independent'}
                {post.author.year ? ` · ${post.author.year}` : ''}
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="cursor-default text-xs text-muted-foreground">
                  <time dateTime={post.created_at}>{timeAgo(post.created_at)}</time>
                </p>
              </TooltipTrigger>
              <TooltipContent>{fullDate(post.created_at)}</TooltipContent>
            </Tooltip>
          </div>
          {post.is_mine ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Post options"
                >
                  <MoreHorizontal className="size-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 aria-hidden="true" />
                  Delete post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
          {post.content}
        </p>

        {/* Attached photo / video */}
        {post.media_type === 'image' && post.media_url ? (
          <div className="mt-3 overflow-hidden rounded-xl border bg-muted/30">
            { }
            <img
              src={mediaSrc(post.media_url)}
              alt="Photo shared in this post"
              loading="lazy"
              className="max-h-[480px] w-full object-cover"
            />
          </div>
        ) : null}
        {post.media_type === 'video' && post.media_url ? (
          <div className="mt-3 overflow-hidden rounded-xl border bg-black">
            <video
              controls
              preload="metadata"
              playsInline
              className="max-h-[480px] w-full"
              aria-label="Video shared in this post"
            >
              <source src={mediaSrc(post.media_url)} />
              Your browser does not support embedded videos.
            </video>
          </div>
        ) : null}

        <div className="mt-3 flex items-center gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => likeMutation.mutate()}
            disabled={likeMutation.isPending}
            aria-pressed={post.liked_by_me}
            className={cn(
              'gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground',
              post.liked_by_me && 'text-rose-500 hover:text-rose-600',
            )}
          >
            <Heart
              className={cn('size-4', post.liked_by_me && 'fill-rose-500')}
              aria-hidden="true"
            />
            {post.likes > 0 ? (
              <span className="tabular-nums">{post.likes}</span>
            ) : (
              <span>Like</span>
            )}
            <span className="sr-only">
              {post.liked_by_me ? 'You liked this post' : 'Like this post'}
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments((open) => !open)}
            aria-expanded={showComments}
            className="gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            <span className="tabular-nums">{post.comments.length}</span>
            <span className="sr-only">
              {showComments ? 'Hide comments' : 'Show comments'}
            </span>
          </Button>
        </div>

        {showComments ? (
          <div className="mt-3 space-y-3 rounded-lg bg-muted/40 p-3">
            {post.comments.length === 0 ? (
              <p className="px-1 text-xs text-muted-foreground">
                No comments yet — start the conversation.
              </p>
            ) : (
              <ul className="space-y-3">
                {post.comments.map((comment) => (
                  <CommentRow key={comment.id} post={post} comment={comment} />
                ))}
              </ul>
            )}

            <div className="flex items-center gap-2">
              <Input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitComment()
                  }
                }}
                placeholder="Write a comment…"
                aria-label={`Write a comment on ${post.author.full_name}'s post`}
                className="h-9 bg-white text-sm"
                maxLength={1000}
              />
              <Button
                size="icon"
                className="size-9 shrink-0 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                onClick={submitComment}
                disabled={commentDraft.trim() === '' || commentMutation.isPending}
                aria-label="Post comment"
              >
                {commentMutation.isPending ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post from the feed for you and your connections.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

export function PostCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="mt-3 border-t pt-3">
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </CardContent>
    </Card>
  )
}

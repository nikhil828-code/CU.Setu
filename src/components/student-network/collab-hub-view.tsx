'use client'

/**
 * Collaboration Hub — post project ideas, build teams and review
 * skill-matched teammate suggestions.
 *
 * Data comes straight from the Flask backend (`/api/collabs`,
 * `/api/collab-applications`, `/api/collabs/{id}/candidates`) — nothing is
 * hardcoded. Owner-only controls (applications, suggestions, close/reopen
 * recruiting, delete) render only for the student who posted the idea.
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Check,
  CheckCircle2,
  Clock,
  Inbox,
  Lightbulb,
  Loader2,
  Lock,
  LockOpen,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
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
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import { timeAgo } from '@/lib/time'
import type { CollabApplicationItem, CollabCandidate, CollabItem } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

const CATEGORIES = [
  'DSA',
  'Web',
  'AI & ML',
  'Mobile',
  'Hardware',
  'Research',
  'Startup',
  'General',
] as const

const TEAM_MIN = 2
const TEAM_MAX = 10

type CollabFilter = 'all' | 'open' | 'mine'

/** Parse a comma-separated skills string into clean chips. */
function csvToSkills(csv: string): string[] {
  return csv
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

function errText(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof ApiError ? error.message : fallback
}

/** Invalidate every collab query after a mutation (prefix-matched keys). */
function invalidateCollabs(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['collabs'] })
  queryClient.invalidateQueries({ queryKey: ['collab-applications'] })
  queryClient.invalidateQueries({ queryKey: ['collab-candidates'] })
}

function CollabCardSkeleton() {
  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="mt-3 flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3.5 w-32" />
        </div>
        <Skeleton className="mt-4 h-8 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

/* ------------------------------ Post an idea -------------------------------- */

function PostIdeaForm({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>('General')
  const [skills, setSkills] = useState('')
  const [teamSize, setTeamSize] = useState(4)
  const [error, setError] = useState<string | null>(null)

  const skillChips = csvToSkills(skills)

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<CollabItem>('/collabs', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          skills_needed: skillChips,
          team_size: teamSize,
        }),
      }),
    onSuccess: () => {
      invalidateCollabs(queryClient)
      onOpenChange(false)
      toast({
        title: 'Idea posted',
        description: 'Your project is live — skill-matched teammates can apply to join now.',
      })
    },
    onError: (mutationError) => {
      toast({
        title: 'Could not post idea',
        description: errText(mutationError),
        variant: 'destructive',
      })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (createMutation.isPending) return
    if (title.trim().length < 4) {
      setError('Title must be at least 4 characters.')
      return
    }
    setError(null)
    createMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="collab-title">Title</Label>
          <span
            className={cn(
              'text-xs tabular-nums',
              title.length > 80 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {title.length}/80
          </span>
        </div>
        <Input
          id="collab-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="e.g. Campus Food Review App"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="collab-description">Description</Label>
        <Textarea
          id="collab-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="What are you building, what stage is it at, and what would teammates do?"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="collab-category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="collab-category" className="w-full">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="collab-skills">Skills needed</Label>
        <Input
          id="collab-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="e.g. React, TypeScript, Flask"
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
        {skillChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {skillChips.map((skill) => (
              <Badge
                key={skill}
                variant="outline"
                className="border-blue-200 bg-blue-50 font-medium text-blue-700"
              >
                {skill}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="collab-team-size">Team size</Label>
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">
            {teamSize} student{teamSize === 1 ? '' : 's'}
          </span>
        </div>
        <Slider
          id="collab-team-size"
          value={[teamSize]}
          min={TEAM_MIN}
          max={TEAM_MAX}
          step={1}
          onValueChange={(values) => setTeamSize(values[0] ?? teamSize)}
          aria-label="Team size"
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={createMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
        >
          {createMutation.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {createMutation.isPending ? 'Posting…' : 'Post idea'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function PostIdeaDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Post an idea</DialogTitle>
          <DialogDescription>
            Share a project you want to build. Skill-matched teammates will be suggested to you
            right away.
          </DialogDescription>
        </DialogHeader>
        {open ? <PostIdeaForm onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------- Apply flow -------------------------------- */

function ApplyForm({ collab, onOpenChange }: { collab: CollabItem; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  const applyMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; status: string }>(`/collabs/${collab.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      }),
    onSuccess: () => {
      invalidateCollabs(queryClient)
      onOpenChange(false)
      toast({
        title: 'Application sent',
        description: `The owner of "${collab.title}" will review your note.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not apply',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!applyMutation.isPending) applyMutation.mutate()
      }}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="apply-message">Message (optional)</Label>
        <Textarea
          id="apply-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={300}
          placeholder="e.g. I've built two React apps and would love to own the frontend."
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={applyMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
        >
          {applyMutation.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          {applyMutation.isPending ? 'Sending…' : 'Send application'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ApplyDialog({
  collab,
  open,
  onOpenChange,
}: {
  collab: CollabItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Apply to join</DialogTitle>
          <DialogDescription>
            Tell the owner of "{collab.title}" why you are a good fit. Skills are matched
            automatically.
          </DialogDescription>
        </DialogHeader>
        {open ? <ApplyForm collab={collab} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Owner: applications -------------------------- */

function ApplicationRow({
  application,
  collab,
}: {
  application: CollabApplicationItem
  collab: CollabItem
}) {
  const queryClient = useQueryClient()
  const openProfile = useAppStore((s) => s.openProfile)

  const acceptMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; joined: string }>(`/collab-applications/${application.id}/accept`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      invalidateCollabs(queryClient)
      toast({
        title: 'Application accepted',
        description: `@${data.joined} joined "${collab.title}".`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not accept application',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; rejected: string }>(`/collab-applications/${application.id}/reject`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      invalidateCollabs(queryClient)
      toast({
        title: 'Application rejected',
        description: `@${data.rejected} was not added to the team.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not reject application',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const busy = acceptMutation.isPending || rejectMutation.isPending

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <UserAvatar
          username={application.applicant.username}
          fullName={application.applicant.full_name}
          avatarUrl={application.applicant.avatar_url}
          size="sm"
          onClick={() => openProfile(application.applicant.username)}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => openProfile(application.applicant.username)}
            className="block truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
          >
            {application.applicant.full_name}
          </button>
          <p className="truncate text-xs text-muted-foreground">
            @{application.applicant.username}
            {application.applicant.programme ? ` · ${application.applicant.programme}` : ''}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Applied {timeAgo(application.created_at)}
          </p>
        </div>
      </div>
      {application.message ? (
        <p className="mt-2 border-l-2 border-amber-300 pl-3 text-sm italic text-muted-foreground">
          &ldquo;{application.message}&rdquo;
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
          onClick={() => acceptMutation.mutate()}
          disabled={busy}
        >
          <Check aria-hidden="true" />
          {acceptMutation.isPending ? 'Accepting…' : 'Accept'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => rejectMutation.mutate()}
          disabled={busy}
        >
          <X aria-hidden="true" />
          {rejectMutation.isPending ? 'Rejecting…' : 'Reject'}
        </Button>
      </div>
    </li>
  )
}

function ApplicationsDialog({
  collab,
  open,
  onOpenChange,
}: {
  collab: CollabItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const applicationsQuery = useQuery({
    queryKey: ['collab-applications'],
    queryFn: () => apiFetch<{ applications: CollabApplicationItem[] }>('/collab-applications'),
    enabled: open,
  })

  const applications = (applicationsQuery.data?.applications ?? []).filter(
    (application) => application.collab_id === collab.id,
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Applications — {collab.title}</DialogTitle>
          <DialogDescription>
            Accepting a student adds them to the team immediately.
          </DialogDescription>
        </DialogHeader>
        {applicationsQuery.isLoading ? (
          <div className="space-y-2.5">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-8 w-full rounded-md" />
              </div>
            ))}
          </div>
        ) : applications.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No pending applications"
            description="When students apply to join this team, their notes will land here."
          />
        ) : (
          <ul className="max-h-[60vh] space-y-2.5 overflow-y-auto thin-scrollbar pr-1">
            {applications.map((application) => (
              <ApplicationRow key={application.id} application={application} collab={collab} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------- Owner: suggestions ---------------------------- */

const RELATIONSHIP_LABEL: Record<string, string> = {
  connected: 'Connected',
  pending_out: 'Request pending',
  pending_in: 'Their request',
  none: 'Not connected',
}

function CandidateRow({ candidate }: { candidate: CollabCandidate }) {
  const openProfile = useAppStore((s) => s.openProfile)
  const coverage = Math.round(candidate.coverage * 100)

  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-start gap-3">
        <UserAvatar
          username={candidate.username}
          fullName={candidate.full_name}
          avatarUrl={candidate.avatar_url}
          size="sm"
          onClick={() => openProfile(candidate.username)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => openProfile(candidate.username)}
              className="truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {candidate.full_name}
            </button>
            {candidate.relationship !== 'self' && candidate.relationship !== 'connected' ? (
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                {RELATIONSHIP_LABEL[candidate.relationship] ?? 'Not connected'}
              </Badge>
            ) : candidate.relationship === 'connected' ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 font-medium text-emerald-700"
              >
                <CheckCircle2 aria-hidden="true" />
                Connected
              </Badge>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            @{candidate.username}
            {candidate.programme ? ` · ${candidate.programme}` : ''}
            {candidate.year ? ` · ${candidate.year}` : ''}
          </p>

          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Skill coverage</span>
              <span className="font-semibold tabular-nums text-foreground">{coverage}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600"
                style={{ width: `${coverage}%` }}
              />
            </div>
          </div>

          {candidate.shared_skills.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidate.shared_skills.map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No overlapping skills yet.</p>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground"
            onClick={() => openProfile(candidate.username)}
          >
            View profile
          </Button>
        </div>
      </div>
    </li>
  )
}

function CandidatesDialog({
  collab,
  open,
  onOpenChange,
}: {
  collab: CollabItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const candidatesQuery = useQuery({
    queryKey: ['collab-candidates', collab.id],
    queryFn: () => apiFetch<{ candidates: CollabCandidate[] }>(`/collabs/${collab.id}/candidates`),
    enabled: open,
  })

  const candidates = candidatesQuery.data?.candidates ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Suggested teammates — {collab.title}</DialogTitle>
          <DialogDescription>
            Ranked by how many of the skills this project needs each student already covers.
          </DialogDescription>
        </DialogHeader>
        {candidatesQuery.isLoading ? (
          <div className="space-y-2.5">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : candidates.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No candidates yet"
            description="Students whose skills overlap with this project will be suggested here."
          />
        ) : (
          <ul className="max-h-[55vh] space-y-2.5 overflow-y-auto thin-scrollbar pr-1">
            {candidates.map((candidate) => (
              <CandidateRow key={candidate.username} candidate={candidate} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------- Card ------------------------------------- */

function CollabCard({ collab }: { collab: CollabItem }) {
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()

  const [applyOpen, setApplyOpen] = useState(false)
  const [applicationsOpen, setApplicationsOpen] = useState(false)
  const [candidatesOpen, setCandidatesOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const closed = collab.status === 'closed'

  const statusMutation = useMutation({
    mutationFn: (nextClosed: boolean) =>
      apiFetch<{ ok: boolean; status: 'open' | 'closed' }>(`/collabs/${collab.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ closed: nextClosed }),
      }),
    onSuccess: (data) => {
      invalidateCollabs(queryClient)
      toast({
        title: data.status === 'closed' ? 'Recruiting closed' : 'Recruiting reopened',
        description:
          data.status === 'closed'
            ? `"${collab.title}" no longer accepts applications.`
            : `"${collab.title}" accepts applications again.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not update status',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; deleted: number }>(`/collabs/${collab.id}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      invalidateCollabs(queryClient)
      setDeleteOpen(false)
      toast({
        title: 'Collab deleted',
        description: `"${collab.title}" was removed from the hub.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not delete collab',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const visibleMembers = collab.members.slice(0, 4)
  const overflow = Math.max(0, collab.member_count - visibleMembers.length)

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="h-full">
      <Card className="h-full rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="flex h-full flex-col p-4">
          {/* Title + status */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-base font-semibold leading-snug tracking-tight text-foreground">
              {collab.title}
            </h3>
            {closed ? (
              <Badge variant="outline" className="shrink-0 border-border bg-muted text-muted-foreground">
                <Lock aria-hidden="true" />
                Closed
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="shrink-0 border-teal-200 bg-teal-50 font-medium text-teal-700"
              >
                <span className="size-1.5 rounded-full bg-teal-500" aria-hidden="true" />
                Open
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              {collab.category}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Posted {timeAgo(collab.created_at)}
            </span>
          </div>

          {/* Owner */}
          <div className="mt-3 flex items-center gap-2">
            <UserAvatar
              username={collab.owner.username}
              fullName={collab.owner.full_name}
              avatarUrl={collab.owner.avatar_url}
              size="sm"
              onClick={() => openProfile(collab.owner.username)}
            />
            <button
              type="button"
              onClick={() => openProfile(collab.owner.username)}
              className="truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {collab.owner.full_name}
            </button>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              owner
            </span>
          </div>

          {/* Description */}
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {collab.description}
          </p>

          {/* Skills needed */}
          {collab.skills_needed.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {collab.skills_needed.slice(0, 5).map((skill) => (
                <Badge
                  key={skill}
                  variant="outline"
                  className="border-blue-200 bg-blue-50 font-medium text-blue-700"
                >
                  {skill}
                </Badge>
              ))}
              {collab.skills_needed.length > 5 ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  +{collab.skills_needed.length - 5}
                </Badge>
              ) : null}
            </div>
          ) : null}

          {/* Team */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
            <div className="flex -space-x-2">
              {visibleMembers.map((member) => (
                <UserAvatar
                  key={member.username}
                  username={member.username}
                  fullName={member.full_name}
                  avatarUrl={member.avatar_url}
                  size="sm"
                  className="ring-2 ring-white"
                  onClick={() => openProfile(member.username)}
                  label={`Open ${member.full_name}'s profile`}
                />
              ))}
              {overflow > 0 ? (
                <span
                  className="flex size-8 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground ring-2 ring-white"
                  aria-label={`${overflow} more member${overflow === 1 ? '' : 's'}`}
                >
                  +{overflow}
                </span>
              ) : null}
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              {collab.member_count}/{collab.team_size} members ·{' '}
              {collab.open_spots > 0
                ? `${collab.open_spots} ${collab.open_spots === 1 ? 'spot' : 'spots'} left`
                : 'Team full'}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-auto pt-4">
            {collab.my_status === 'owner' ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApplicationsOpen(true)}
                >
                  <Inbox aria-hidden="true" />
                  Applications ({collab.pending_count})
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCandidatesOpen(true)}>
                  <Sparkles aria-hidden="true" />
                  Suggested teammates
                </Button>
                <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Manage ${collab.title}`}
                        className="size-8"
                      >
                        <MoreHorizontal className="size-4" aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => statusMutation.mutate(!closed)}
                        disabled={statusMutation.isPending}
                      >
                        {closed ? (
                          <LockOpen aria-hidden="true" />
                        ) : (
                          <Lock aria-hidden="true" />
                        )}
                        {closed ? 'Reopen recruiting' : 'Close recruiting'}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => setDeleteOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 aria-hidden="true" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this collab?</AlertDialogTitle>
                      <AlertDialogDescription>
                        &ldquo;{collab.title}&rdquo; and its pending applications will be
                        permanently removed. Current members will lose access.
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
              </div>
            ) : collab.my_status === 'member' ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
                You&rsquo;re on the team
              </span>
            ) : collab.my_status === 'applied' ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                <Clock className="size-3.5" aria-hidden="true" />
                Application pending
              </span>
            ) : closed ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" />
                Recruiting closed
              </span>
            ) : (
              <Button
                size="sm"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                onClick={() => setApplyOpen(true)}
              >
                <UserPlus aria-hidden="true" />
                Apply to join
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <ApplyDialog collab={collab} open={applyOpen} onOpenChange={setApplyOpen} />
      <ApplicationsDialog collab={collab} open={applicationsOpen} onOpenChange={setApplicationsOpen} />
      <CandidatesDialog collab={collab} open={candidatesOpen} onOpenChange={setCandidatesOpen} />
    </motion.div>
  )
}

/* --------------------------------- View ------------------------------------- */

function CollabGrid({ collabs, empty }: { collabs: CollabItem[]; empty: React.ReactNode }) {
  if (collabs.length === 0) return <>{empty}</>
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {collabs.map((collab) => (
        <CollabCard key={collab.id} collab={collab} />
      ))}
    </div>
  )
}

function CountPill({ value }: { value: number }) {
  return (
    <span className="ml-1.5 rounded-full bg-muted-foreground/20 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
      {value}
    </span>
  )
}

export function CollabHubView() {
  const [filter, setFilter] = useState<CollabFilter>('all')
  const [postOpen, setPostOpen] = useState(false)

  const collabsQuery = useQuery({
    queryKey: ['collabs'],
    queryFn: () => apiFetch<{ collabs: CollabItem[] }>('/collabs'),
  })

  const collabs = collabsQuery.data?.collabs ?? []
  const openCollabs = collabs.filter((c) => c.status === 'open')
  const mineCollabs = collabs.filter((c) => c.is_owner || c.my_status === 'member')

  const postIdeaButton = (
    <Button
      onClick={() => setPostOpen(true)}
      className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
    >
      <Plus aria-hidden="true" />
      Post an idea
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SectionHeader
          title="Collaboration Hub"
          subtitle="Post project ideas, build teams and get skill-matched teammate suggestions from across campus."
          action={postIdeaButton}
        />

        {collabsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <CollabCardSkeleton key={i} />
            ))}
          </div>
        ) : collabsQuery.isError ? (
          <EmptyState
            icon={Inbox}
            title="Could not load the hub"
            description="The collaboration service could not be reached. Please refresh and try again."
          />
        ) : (
          <Tabs value={filter} onValueChange={(value) => setFilter(value as CollabFilter)}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">
                All
                <CountPill value={collabs.length} />
              </TabsTrigger>
              <TabsTrigger value="open">
                Open
                <CountPill value={openCollabs.length} />
              </TabsTrigger>
              <TabsTrigger value="mine">
                Mine
                <CountPill value={mineCollabs.length} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <CollabGrid
                collabs={collabs}
                empty={
                  <EmptyState
                    icon={Lightbulb}
                    title="Be the first to post an idea"
                    description="No collabs have been posted yet. Share a project you want to build and let skill-matched teammates find you."
                    action={postIdeaButton}
                  />
                }
              />
            </TabsContent>
            <TabsContent value="open" className="mt-0">
              <CollabGrid
                collabs={openCollabs}
                empty={
                  <EmptyState
                    icon={Lightbulb}
                    title="No open collabs right now"
                    description="Every posted team is either full or closed. Post your own idea to start recruiting."
                    action={postIdeaButton}
                  />
                }
              />
            </TabsContent>
            <TabsContent value="mine" className="mt-0">
              <CollabGrid
                collabs={mineCollabs}
                empty={
                  <EmptyState
                    icon={Users}
                    title="Nothing of yours here yet"
                    description="Collabs you own or belong to will show up in this tab."
                    action={postIdeaButton}
                  />
                }
              />
            </TabsContent>
          </Tabs>
        )}

        <PostIdeaDialog open={postOpen} onOpenChange={setPostOpen} />
      </motion.div>
    </div>
  )
}

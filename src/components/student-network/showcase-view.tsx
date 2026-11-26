'use client'

/**
 * Project Showcase — publish student-built projects with covers, tech
 * stacks, links and credited contributors.
 *
 * Data comes straight from the Flask backend (`/api/projects`): a Featured
 * spotlight strip at the top, a category filter (chips built from the
 * categories present in the data) and a responsive project grid. Owners get
 * an ellipsis menu on their own cards — edit, feature/unfeature, manage
 * contributors and delete (with confirmation).
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ExternalLink,
  FolderKanban,
  Github,
  ImageIcon,
  Inbox,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch, apiUpload, mediaSrc } from '@/lib/api'
import { timeAgo } from '@/lib/time'
import type { ProjectItem } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'

const CATEGORIES: readonly string[] = [
  'Web',
  'DSA',
  'AI & ML',
  'Mobile',
  'Hardware',
  'Research',
  'Startup',
  'General',
]

/** Matches the backend media limit (config.MAX_MEDIA_BYTES). */
const COVER_LIMIT = 25 * 1024 * 1024

/** Parse a comma-separated tech stack string into clean chips. */
function csvToTech(csv: string): string[] {
  return csv
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

function errText(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return error instanceof ApiError ? error.message : fallback
}

/** Invalidate every projects query after a mutation (prefix-matched keys). */
function invalidateProjects(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['projects'] })
}

/** Two-letter monogram for the cover placeholder (from the project title). */
function coverInitials(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'P'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0].charAt(0)}${words[1].charAt(0)}`.toUpperCase()
}

/* ------------------------------- Card pieces -------------------------------- */

function ProjectCover({ project, className }: { project: ProjectItem; className?: string }) {
  if (project.cover_url !== '') {
    return (
      <img
        src={mediaSrc(project.cover_url)}
        alt={`${project.title} cover image`}
        loading="lazy"
        draggable={false}
        className={cn('aspect-video w-full object-cover', className)}
      />
    )
  }
  // Tasteful navy placeholder when the project has no cover yet.
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#16294F] via-[#0F1F46] to-[#0A1631]',
        className,
      )}
    >
      <span className="absolute -right-8 -top-8 size-32 rounded-full bg-amber-500/10 blur-2xl" />
      <span className="absolute -bottom-10 -left-6 size-28 rounded-full bg-sky-500/10 blur-2xl" />
      <span className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-lg font-bold text-amber-300 backdrop-blur-sm">
        {coverInitials(project.title)}
      </span>
      <FolderKanban className="absolute bottom-3 right-3 size-7 text-white/20" />
    </div>
  )
}

function OwnerRow({ project }: { project: ProjectItem }) {
  const openProfile = useAppStore((s) => s.openProfile)
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <UserAvatar
        username={project.owner.username}
        fullName={project.owner.full_name}
        avatarUrl={project.owner.avatar_url}
        size="sm"
        onClick={() => openProfile(project.owner.username)}
      />
      <button
        type="button"
        onClick={() => openProfile(project.owner.username)}
        className="truncate text-left text-sm font-medium hover:underline focus-visible:outline-none focus-visible:underline"
      >
        {project.owner.full_name}
      </button>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        owner
      </span>
    </div>
  )
}

function MetaRow({ project }: { project: ProjectItem }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
        {project.category}
      </Badge>
      <span className="text-xs text-muted-foreground">Published {timeAgo(project.created_at)}</span>
    </div>
  )
}

function TechChips({ stack, limit = 5 }: { stack: string[]; limit?: number }) {
  if (stack.length === 0) return null
  const shown = stack.slice(0, limit)
  const overflow = stack.length - shown.length
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {shown.map((tech) => (
        <Badge
          key={tech}
          variant="outline"
          className="border-blue-200 bg-blue-50 font-medium text-blue-700"
        >
          {tech}
        </Badge>
      ))}
      {overflow > 0 ? (
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          +{overflow}
        </Badge>
      ) : null}
    </div>
  )
}

function ProjectLinks({ project, className }: { project: ProjectItem; className?: string }) {
  if (project.github_url === '' && project.demo_url === '') return null
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {project.github_url !== '' ? (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-3">
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open the GitHub repository of ${project.title}`}
          >
            <Github className="size-3.5" aria-hidden="true" />
            GitHub
          </a>
        </Button>
      ) : null}
      {project.demo_url !== '' ? (
        <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 px-3">
          <a
            href={project.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open the live demo of ${project.title}`}
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Demo
          </a>
        </Button>
      ) : null}
    </div>
  )
}

function FeaturedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-md',
        className,
      )}
    >
      <Star className="size-3 fill-white" aria-hidden="true" />
      Featured
    </span>
  )
}

/* ------------------------------ Featured strip ------------------------------- */

function FeaturedCard({ project }: { project: ProjectItem }) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.15 }}
      className="w-[300px] shrink-0 snap-start sm:w-[340px]"
    >
      <Card className="flex h-full flex-col overflow-hidden rounded-xl border bg-card py-0 shadow-sm transition-shadow hover:shadow-md">
        <div className="relative">
          <ProjectCover project={project} />
          <FeaturedBadge className="absolute left-3 top-3" />
        </div>
        <CardContent className="flex flex-1 flex-col p-4">
          <h3 className="text-base font-semibold leading-snug tracking-tight text-foreground">
            {project.title}
          </h3>
          <OwnerRow project={project} />
          <MetaRow project={project} />
          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>
          <TechChips stack={project.tech_stack} limit={4} />
          <div className="mt-auto pt-4">
            <ProjectLinks project={project} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* --------------------------------- Grid card -------------------------------- */

function ProjectCard({
  project,
  onEdit,
  onManageContributors,
}: {
  project: ProjectItem
  onEdit: (project: ProjectItem) => void
  onManageContributors: (project: ProjectItem) => void
}) {
  const openProfile = useAppStore((s) => s.openProfile)
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const featureMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; featured: boolean }>(`/projects/${project.id}/featured`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      invalidateProjects(queryClient)
      toast({
        title: data.featured ? 'Added to Featured' : 'Removed from Featured',
        description: data.featured
          ? `"${project.title}" now shines in the spotlight strip.`
          : `"${project.title}" left the spotlight strip.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not update the spotlight',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; deleted: number }>(`/projects/${project.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      invalidateProjects(queryClient)
      setDeleteOpen(false)
      toast({
        title: 'Project deleted',
        description: `"${project.title}" was removed from the showcase.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not delete project',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const visibleContributors = project.contributors.slice(0, 4)
  const overflow = Math.max(0, project.contributors.length - visibleContributors.length)

  return (
    <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }} className="h-full">
      <Card className="flex h-full flex-col overflow-hidden rounded-xl border bg-card py-0 shadow-sm transition-shadow hover:shadow-md">
        <div className="relative">
          <ProjectCover project={project} />
          {project.featured ? <FeaturedBadge className="absolute left-3 top-3" /> : null}
        </div>

        <CardContent className="flex flex-1 flex-col p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 text-base font-semibold leading-snug tracking-tight text-foreground">
              {project.title}
            </h3>
            {project.is_mine ? (
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label={`Manage ${project.title}`}
                    >
                      <MoreHorizontal className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onEdit(project)}>
                      <Pencil aria-hidden="true" />
                      Edit details
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => featureMutation.mutate()}
                      disabled={featureMutation.isPending}
                    >
                      <Star aria-hidden="true" />
                      {project.featured ? 'Remove from Featured' : 'Add to Featured'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onManageContributors(project)}>
                      <UserPlus aria-hidden="true" />
                      Contributors ({project.contributors.length})
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
                    <AlertDialogTitle>Delete this project?</AlertDialogTitle>
                    <AlertDialogDescription>
                      &ldquo;{project.title}&rdquo; and its contributor credits will be permanently
                      removed from the showcase.
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
            ) : null}
          </div>

          <OwnerRow project={project} />
          <MetaRow project={project} />

          <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {project.description}
          </p>

          <TechChips stack={project.tech_stack} />

          {project.contributors.length > 0 ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex -space-x-2">
                {visibleContributors.map((member) => (
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
                    aria-label={`${overflow} more contributor${overflow === 1 ? '' : 's'}`}
                  >
                    +{overflow}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {project.contributors.length}{' '}
                {project.contributors.length === 1 ? 'contributor' : 'contributors'}
              </p>
            </div>
          ) : null}

          <div className="mt-auto pt-4">
            <ProjectLinks project={project} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

/* ---------------------------- Publish / edit form ---------------------------- */

function ProjectForm({
  project,
  onOpenChange,
}: {
  project: ProjectItem | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState(project?.title ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [category, setCategory] = useState(project?.category ?? 'Web')
  const [tech, setTech] = useState(project ? project.tech_stack.join(', ') : '')
  const [githubUrl, setGithubUrl] = useState(project?.github_url ?? '')
  const [demoUrl, setDemoUrl] = useState(project?.demo_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState('')
  const [error, setError] = useState<string | null>(null)

  const editing = project !== null
  const techChips = csvToTech(tech)

  // Release the preview object URL whenever it is replaced or unmounted.
  useEffect(
    () => () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview)
    },
    [coverPreview],
  )

  const saveMutation = useMutation({
    mutationFn: () => {
      const form = new FormData()
      form.append('title', title.trim())
      form.append('description', description.trim())
      form.append('tech_stack', techChips.join(','))
      form.append('github_url', githubUrl.trim())
      form.append('demo_url', demoUrl.trim())
      form.append('category', category)
      if (coverFile) form.append('cover', coverFile)
      // Multipart keeps the existing cover when no file is attached (PUT).
      return apiUpload<ProjectItem>(
        editing ? `/projects/${project.id}` : '/projects',
        form,
        editing ? 'PUT' : 'POST',
      )
    },
    onSuccess: (saved) => {
      invalidateProjects(queryClient)
      onOpenChange(false)
      toast({
        title: editing ? 'Project updated' : 'Project published',
        description: editing
          ? `"${saved.title}" was saved.`
          : `"${saved.title}" is live on the showcase.`,
      })
    },
    onError: (mutationError) => {
      toast({
        title: editing ? 'Could not save changes' : 'Could not publish',
        description: errText(mutationError),
        variant: 'destructive',
      })
    },
  })

  function pickCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Images only',
        description: 'Pick a PNG or JPG file for the cover.',
        variant: 'destructive',
      })
      return
    }
    if (file.size > COVER_LIMIT) {
      toast({
        title: 'File too large',
        description: 'Cover images are limited to 25 MB.',
        variant: 'destructive',
      })
      return
    }
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  function clearCover() {
    setCoverFile(null)
    setCoverPreview('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveMutation.isPending) return
    if (title.trim().length < 4 || title.trim().length > 80) {
      setError('Title must be 4-80 characters.')
      return
    }
    setError(null)
    saveMutation.mutate()
  }

  const categoryOptions =
    project && !CATEGORIES.includes(project.category)
      ? [...CATEGORIES, project.category]
      : [...CATEGORIES]

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Cover picker */}
      <div className="space-y-2">
        <Label>Cover image</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={pickCover}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-2.5 transition-colors hover:border-orange-300 hover:bg-orange-50/40">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500"
            aria-label="Choose a cover image"
          >
            <ImageIcon className="size-5 text-muted-foreground" aria-hidden="true" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {coverFile
                ? coverFile.name
                : editing && project.cover_url !== ''
                  ? 'Cover set — choose a new file to replace it'
                  : 'Add a cover image (optional)'}
            </p>
            <p className="text-xs text-muted-foreground">PNG or JPG up to 25 MB</p>
          </div>
          {coverFile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={clearCover}
              aria-label="Remove the chosen cover"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="shrink-0"
            >
              Browse
            </Button>
          )}
        </div>
        {coverPreview !== '' ? (
          <img
            src={coverPreview}
            alt="Chosen cover preview"
            className="aspect-video w-full rounded-lg border object-cover"
          />
        ) : editing && project.cover_url !== '' ? (
          <div className="relative">
            <img
              src={mediaSrc(project.cover_url)}
              alt="Current cover"
              className="aspect-video w-full rounded-lg border object-cover"
            />
            <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
              current
            </span>
          </div>
        ) : null}
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="project-title">Title</Label>
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
          id="project-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={80}
          placeholder="e.g. Campus Food Review App"
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="project-description">Description</Label>
          <span
            className={cn(
              'text-xs tabular-nums',
              description.length > 800 ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            {description.length}/800
          </span>
        </div>
        <Textarea
          id="project-description"
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={800}
          placeholder="What does it do, what did you build it with, what is next?"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="project-category">Category</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger id="project-category" className="w-full">
            <SelectValue placeholder="Pick a category" />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tech stack */}
      <div className="space-y-2">
        <Label htmlFor="project-tech">Tech stack</Label>
        <Input
          id="project-tech"
          value={tech}
          onChange={(e) => setTech(e.target.value)}
          placeholder="e.g. React, TypeScript, Flask"
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
        {techChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {techChips.map((item) => (
              <Badge
                key={item}
                variant="outline"
                className="border-blue-200 bg-blue-50 font-medium text-blue-700"
              >
                {item}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>

      {/* Links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-github">GitHub URL</Label>
          <Input
            id="project-github"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="https://github.com/you/repo"
            inputMode="url"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-demo">Demo URL</Label>
          <Input
            id="project-demo"
            value={demoUrl}
            onChange={(e) => setDemoUrl(e.target.value)}
            placeholder="https://your-demo.dev"
            inputMode="url"
          />
        </div>
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
          disabled={saveMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
        >
          {saveMutation.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : editing ? (
            <Pencil aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {saveMutation.isPending
            ? editing
              ? 'Saving…'
              : 'Publishing…'
            : editing
              ? 'Save changes'
              : 'Publish project'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function ProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const editing = project !== null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit project' : 'Publish a project'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the details — leave the cover picker untouched to keep the current cover.'
              : 'Show the campus what you built: add a cover, the stack you used and links to try it.'}
          </DialogDescription>
        </DialogHeader>
        {open ? <ProjectForm project={project} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Contributors --------------------------------- */

function ContributorsManager({ project }: { project: ProjectItem }) {
  const queryClient = useQueryClient()
  const openProfile = useAppStore((s) => s.openProfile)
  const [username, setUsername] = useState('')

  const addMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ ok: boolean; added: string }>(`/projects/${project.id}/contributors`, {
        method: 'POST',
        body: JSON.stringify({ username: name }),
      }),
    onSuccess: (data) => {
      invalidateProjects(queryClient)
      setUsername('')
      toast({
        title: 'Contributor credited',
        description: `@${data.added} was notified about the credit.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not add contributor',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (name: string) =>
      apiFetch<{ ok: boolean; removed: string }>(
        `/projects/${project.id}/contributors/${name}`,
        { method: 'DELETE' },
      ),
    onSuccess: (data) => {
      invalidateProjects(queryClient)
      toast({
        title: 'Contributor removed',
        description: `@${data.removed} is no longer credited on this project.`,
      })
    },
    onError: (error) => {
      toast({
        title: 'Could not remove contributor',
        description: errText(error),
        variant: 'destructive',
      })
    },
  })

  function submitAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = username.trim().replace(/^@/, '')
    if (name === '' || addMutation.isPending) return
    addMutation.mutate(name)
  }

  const busy = addMutation.isPending || removeMutation.isPending

  return (
    <div className="space-y-4">
      <form onSubmit={submitAdd} className="flex gap-2">
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. ishita"
          aria-label="Username to credit"
          maxLength={40}
          className="flex-1"
        />
        <Button
          type="submit"
          disabled={username.trim() === '' || addMutation.isPending}
          className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
        >
          {addMutation.isPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          Add
        </Button>
      </form>

      {project.contributors.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          No contributors credited yet — add the teammates who helped build this.
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto thin-scrollbar pr-1">
          {project.contributors.map((member) => (
            <li key={member.username} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <UserAvatar
                username={member.username}
                fullName={member.full_name}
                avatarUrl={member.avatar_url}
                size="sm"
                onClick={() => openProfile(member.username)}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">@{member.username}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate(member.username)}
                disabled={busy}
                aria-label={`Remove ${member.full_name} from contributors`}
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ContributorsDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectItem
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contributors — {project.title}</DialogTitle>
          <DialogDescription>
            Credit the teammates who helped build this project. They get a notification as soon
            as they are added.
          </DialogDescription>
        </DialogHeader>
        {open ? <ContributorsManager project={project} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------- Skeleton ---------------------------------- */

function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl border bg-card py-0 shadow-sm">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-4/5" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <Skeleton className="h-8 w-44 rounded-md" />
      </div>
    </Card>
  )
}

/* ----------------------------------- View ----------------------------------- */

export function ShowcaseView() {
  const queryClient = useQueryClient()
  const [category, setCategory] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)
  const [editing, setEditing] = useState<ProjectItem | null>(null)
  const [contributorsId, setContributorsId] = useState<number | null>(null)

  const projectsQuery = useQuery({
    queryKey: ['projects', category],
    queryFn: () =>
      apiFetch<{ projects: ProjectItem[] }>(
        category === '' ? '/projects' : `/projects?category=${encodeURIComponent(category)}`,
      ),
  })

  const projects = projectsQuery.data?.projects ?? []
  const featured = projects.filter((project) => project.featured)
  const contributorsProject = projects.find((project) => project.id === contributorsId) ?? null

  // Chips: All + the fixed categories + any custom category seen in any
  // cached ['projects', ...] query (the view always loads "All" first, so
  // custom categories are known from the very first render after fetch).
  const categories = useMemo(() => {
    const seen = new Set<string>()
    const cached = queryClient.getQueriesData<{ projects: ProjectItem[] }>({
      queryKey: ['projects'],
    })
    for (const [, data] of cached) {
      for (const project of data?.projects ?? []) seen.add(project.category)
    }
    const custom = [...seen].filter((name) => !CATEGORIES.includes(name)).sort()
    return ['', ...CATEGORIES, ...custom]
  }, [projectsQuery.data, queryClient])

  function openCreate() {
    setEditing(null)
    setPublishOpen(true)
  }

  function openEdit(project: ProjectItem) {
    setEditing(project)
    setPublishOpen(true)
  }

  function handlePublishOpenChange(open: boolean) {
    setPublishOpen(open)
    if (!open) setEditing(null)
  }

  const publishButton = (
    <Button
      onClick={openCreate}
      className="bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
    >
      <Plus aria-hidden="true" />
      Publish a project
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        <SectionHeader
          title="Project Showcase"
          subtitle="Student-built projects with covers, tech stacks, links and contributors."
          action={publishButton}
        />

        {projectsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        ) : projectsQuery.isError ? (
          <EmptyState
            icon={Inbox}
            title="Could not load the showcase"
            description="The showcase service could not be reached. Please refresh and try again."
          />
        ) : (
          <>
            {/* Featured spotlight strip */}
            {featured.length > 0 ? (
              <section className="mb-6" aria-label="Featured projects">
                <div className="mb-2.5 flex items-center gap-2">
                  <Star className="size-4 fill-amber-400 text-amber-500" aria-hidden="true" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">
                    Featured
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {featured.length === 1
                      ? '1 project in the spotlight'
                      : `${featured.length} projects in the spotlight`}
                  </span>
                </div>
                <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3 thin-scrollbar">
                  {featured.map((project) => (
                    <FeaturedCard key={project.id} project={project} />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Category filter chips */}
            <div
              className="mb-4 flex gap-2 overflow-x-auto pb-1 thin-scrollbar"
              role="tablist"
              aria-label="Filter projects by category"
            >
              {categories.map((name) => {
                const active = name === category
                return (
                  <button
                    key={name === '' ? 'all' : name}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setCategory(name)}
                    className={cn(
                      'h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]',
                      active
                        ? 'border-transparent bg-[#0F1F46] text-white shadow-sm'
                        : 'border-border bg-card text-muted-foreground hover:border-slate-300 hover:text-foreground',
                    )}
                  >
                    {name === '' ? 'All' : name}
                  </button>
                )
              })}
            </div>

            {projects.length === 0 ? (
              category === '' ? (
                <EmptyState
                  icon={FolderKanban}
                  title="No projects published yet"
                  description="Be the first — publish a project with a cover, tech stack and links so the campus can see what you built."
                  action={publishButton}
                />
              ) : (
                <EmptyState
                  icon={FolderKanban}
                  title={`Nothing in ${category} yet`}
                  description="No projects in this category so far. Publish yours or pick another category."
                />
              )
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={openEdit}
                    onManageContributors={(target) => setContributorsId(target.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <ProjectDialog project={editing} open={publishOpen} onOpenChange={handlePublishOpenChange} />
        {contributorsProject ? (
          <ContributorsDialog
            project={contributorsProject}
            open={contributorsId !== null}
            onOpenChange={(open) => {
              if (!open) setContributorsId(null)
            }}
          />
        ) : null}
      </motion.div>
    </div>
  )
}

'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import { invalidateNetwork } from '@/lib/invalidate'
import type { UserSummary } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

const YEAR_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  'PG 1st Year',
  'PG 2nd Year',
]

const BIO_LIMIT = 280

function csvToList(csv: string): string[] {
  return csv
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '')
}

/**
 * The form is mounted fresh every time the dialog opens, so its fields are
 * initialised from the current user without needing an effect.
 */
function EditProfileForm({
  me,
  onOpenChange,
}: {
  me: UserSummary
  onOpenChange: (open: boolean) => void
}) {
  const setMe = useAppStore((s) => s.setMe)
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState(me.full_name)
  const [programme, setProgramme] = useState(me.programme)
  const [year, setYear] = useState(me.year)
  const [bio, setBio] = useState(me.bio)
  const [skills, setSkills] = useState(me.skills.join(', '))
  const [interests, setInterests] = useState(me.interests.join(', '))
  const [error, setError] = useState<string | null>(null)

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ user: UserSummary }>('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          full_name: fullName.trim(),
          programme: programme.trim(),
          year: year.trim(),
          bio: bio.trim(),
          skills: csvToList(skills),
          interests: csvToList(interests),
        }),
      }),
    onSuccess: ({ user }) => {
      setMe(user)
      invalidateNetwork(queryClient)
      onOpenChange(false)
      toast({ title: 'Profile updated', description: 'Your changes are live.' })
    },
    onError: (error) => {
      const message =
        error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'
      setError(message)
      toast({ title: 'Could not save profile', description: message, variant: 'destructive' })
    },
  })

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saveMutation.isPending) return
    if (fullName.trim() === '') {
      setError('Please provide your full name.')
      return
    }
    if (bio.length > BIO_LIMIT) {
      setError(`Bio must be at most ${BIO_LIMIT} characters.`)
      return
    }
    saveMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-fullname">Full name</Label>
        <Input
          id="edit-fullname"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={60}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-programme">Programme</Label>
          <Input
            id="edit-programme"
            value={programme}
            onChange={(e) => setProgramme(e.target.value)}
            maxLength={60}
            placeholder="e.g. B.Tech CSE"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-year">Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="edit-year" className="w-full">
              <SelectValue placeholder="Select your year" />
            </SelectTrigger>
            <SelectContent>
              {YEAR_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="edit-bio">Bio</Label>
          <span
            className={`text-xs tabular-nums ${
              bio.length > BIO_LIMIT ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {bio.length}/{BIO_LIMIT}
          </span>
        </div>
        <Textarea
          id="edit-bio"
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={BIO_LIMIT}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-skills">Skills</Label>
        <Input
          id="edit-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="e.g. Python, React, DSA"
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-interests">Interests</Label>
        <Input
          id="edit-interests"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          placeholder="e.g. Robotics, Open Source"
        />
        <p className="text-xs text-muted-foreground">Comma-separated</p>
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
          className="bg-[#101B3D] text-white hover:bg-[#182650]"
        >
          {saveMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {saveMutation.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function EditProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const me = useAppStore((s) => s.me)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto thin-scrollbar sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Update how other students see you across the network.
          </DialogDescription>
        </DialogHeader>
        {me ? <EditProfileForm me={me} onOpenChange={onOpenChange} /> : null}
      </DialogContent>
    </Dialog>
  )
}

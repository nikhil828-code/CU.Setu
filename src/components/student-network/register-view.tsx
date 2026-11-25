'use client'

import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import { useState } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import type { UserSummary } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

const PROGRAMME_SUGGESTIONS = [
  'B.Tech CSE',
  'B.Tech ECE',
  'B.Tech IT',
  'B.Tech Mech',
  'M.Tech AI & DS',
  'BCA',
  'B.Sc Data Science',
  'M.Sc CS',
]

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

interface FormErrors {
  full_name?: string
  username?: string
  password?: string
  confirm?: string
  form?: string
}

export function RegisterView() {
  const goto = useAppStore((s) => s.goto)
  const setMe = useAppStore((s) => s.setMe)
  const queryClient = useQueryClient()

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [programme, setProgramme] = useState('')
  const [year, setYear] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState('')
  const [interests, setInterests] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (fullName.trim() === '') next.full_name = 'Please tell us your full name.'
    if (!/^[a-z0-9_]{3,24}$/.test(username.trim())) {
      next.username =
        '3–24 characters: lowercase letters, digits and underscore only.'
    }
    if (password.length < 6) next.password = 'Password must be at least 6 characters.'
    if (confirmPassword !== password) next.confirm = 'Passwords do not match.'
    return next
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    const validation = validate()
    setErrors(validation)
    if (Object.keys(validation).length > 0) return

    setSubmitting(true)
    try {
      const { user } = await apiFetch<{ user: UserSummary }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim(),
          password,
          full_name: fullName.trim(),
          programme: programme.trim(),
          year: year.trim(),
          bio: bio.trim(),
          skills: csvToList(skills),
          interests: csvToList(interests),
        }),
      })
      queryClient.clear()
      setMe(user)
      goto('feed')
      toast({
        title: `Welcome to CU.Setu, ${user.full_name.split(' ')[0]}`,
        description: 'Your first edge in the graph has been added.',
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.'
      setErrors({ form: message })
      toast({ title: 'Could not create account', description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0F1F46]">
      <main className="flex w-full flex-col items-center justify-center px-4 py-10 lg:pl-16">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={() => goto('landing')}
              aria-label="CU.Setu home"
              className="flex items-center gap-2.5"
            >
              <BrandMark className="h-10 w-auto" />
            </button>
            <h1 className="text-2xl font-semibold text-white">Create your account</h1>
            <p className="text-sm text-slate-400">
              Join the bridge connecting the students of Chanakya University.
            </p>
          </div>

          <Card className="border-white/10 shadow-xl shadow-black/30">
            <CardContent className="p-6 sm:p-8">
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-fullname">Full name</Label>
                    <Input
                      id="reg-fullname"
                      placeholder="e.g. Aarav Sharma"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      aria-invalid={errors.full_name ? true : undefined}
                    />
                    {errors.full_name ? (
                      <p className="text-xs font-medium text-destructive">{errors.full_name}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      placeholder="e.g. aarav_07"
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      aria-invalid={errors.username ? true : undefined}
                    />
                    {errors.username ? (
                      <p className="text-xs font-medium text-destructive">{errors.username}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        3–24 characters · lowercase letters, digits, underscore
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <Input
                      id="reg-password"
                      type="password"
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={errors.password ? true : undefined}
                    />
                    {errors.password ? (
                      <p className="text-xs font-medium text-destructive">{errors.password}</p>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm password</Label>
                    <Input
                      id="reg-confirm"
                      type="password"
                      placeholder="Repeat your password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      aria-invalid={errors.confirm ? true : undefined}
                    />
                    {errors.confirm ? (
                      <p className="text-xs font-medium text-destructive">{errors.confirm}</p>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-programme">Programme</Label>
                    <Input
                      id="reg-programme"
                      placeholder="e.g. B.Tech CSE"
                      list="programme-suggestions"
                      value={programme}
                      onChange={(e) => setProgramme(e.target.value)}
                    />
                    <datalist id="programme-suggestions">
                      {PROGRAMME_SUGGESTIONS.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-year">Year</Label>
                    <Select value={year} onValueChange={setYear}>
                      <SelectTrigger id="reg-year" className="w-full">
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
                    <Label htmlFor="reg-bio">Bio</Label>
                    <span
                      className={`text-xs tabular-nums ${
                        bio.length > BIO_LIMIT ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {bio.length}/{BIO_LIMIT}
                    </span>
                  </div>
                  <Textarea
                    id="reg-bio"
                    placeholder="A line about you — what you build, study or love."
                    rows={3}
                    maxLength={BIO_LIMIT}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="reg-skills">Skills</Label>
                    <Input
                      id="reg-skills"
                      placeholder="e.g. Python, React, DSA"
                      value={skills}
                      onChange={(e) => setSkills(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-interests">Interests</Label>
                    <Input
                      id="reg-interests"
                      placeholder="e.g. Robotics, Open Source"
                      value={interests}
                      onChange={(e) => setInterests(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Comma-separated</p>
                  </div>
                </div>

                {errors.form ? (
                  <p className="text-sm font-medium text-destructive" role="alert">
                    {errors.form}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm hover:from-amber-600 hover:to-orange-700"
                >
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {submitting ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <button
              type="button"
              className="font-medium text-amber-300 hover:underline"
              onClick={() => goto('login')}
            >
              Log in
            </button>
          </div>
        </div>
      </main>

      {/* Side panel visual (lg+) — the Chanakya University campus */}
      <aside className="relative hidden w-[420px] shrink-0 lg:block" aria-hidden="true">
        <Image
          src="/cu-campus.jpg"
          alt=""
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A1631] via-[#0F1F46]/55 to-transparent" />
        <div className="absolute bottom-10 left-8 right-8">
          <BrandMark className="h-12 w-auto" />
          <p className="mt-3 text-lg font-medium leading-relaxed text-white">
            Great networks are built one edge at a time.
          </p>
          <p className="mt-2 text-sm text-slate-400">— the CU.Setu principle</p>
        </div>
      </aside>
    </div>
  )
}

'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/hooks/use-toast'
import { ApiError, apiFetch } from '@/lib/api'
import type { UserSummary } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

export function LoginView() {
  const goto = useAppStore((s) => s.goto)
  const setMe = useAppStore((s) => s.setMe)
  const queryClient = useQueryClient()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (username.trim() === '' || password === '') {
      setError('Please enter your username and password.')
      return
    }

    setSubmitting(true)
    try {
      const { user } = await apiFetch<{ user: UserSummary }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      })
      queryClient.clear()
      setMe(user)
      goto('feed')
      toast({
        title: `Welcome back, ${user.full_name.split(' ')[0]}`,
        description: 'Your network is ready.',
      })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.'
      setError(message)
      toast({ title: 'Login failed', description: message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  function fillDemo() {
    setUsername('aarav')
    setPassword('pass123')
    setError(null)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A1128] px-4 py-10">
      <main className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={() => goto('landing')}
            className="flex items-center gap-2.5"
            aria-label="CampusConnect home"
          >
            <BrandMark className="size-10" />
          </button>
          <h1 className="text-2xl font-semibold text-white">Welcome back</h1>
          <p className="text-sm text-slate-400">Log in to CampusConnect</p>
        </div>

        <Card className="border-white/10 shadow-xl shadow-black/30">
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} noValidate>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-username">Username</Label>
                  <Input
                    id="login-username"
                    autoComplete="username"
                    placeholder="e.g. aarav"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={error ? true : undefined}
                  />
                </div>

                {error ? (
                  <p className="text-sm font-medium text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#101B3D] text-white hover:bg-[#182650]"
                >
                  {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {submitting ? 'Logging in…' : 'Log in'}
                </Button>
              </div>
            </form>

            <div className="mt-5 rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <Sparkles className="size-3.5 text-[#2563EB]" aria-hidden="true" />
                Try the demo
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">aarav</span> ·{' '}
                <span className="font-medium text-foreground">pass123</span> — a fully
                connected demo student.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={fillDemo}
              >
                Fill demo credentials
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm">
          <p className="text-slate-400">
            New to CampusConnect?{' '}
            <button
              type="button"
              className="font-medium text-[#93C5FD] hover:underline"
              onClick={() => goto('register')}
            >
              Create an account
            </button>
          </p>
          <button
            type="button"
            className="text-slate-500 hover:text-slate-300"
            onClick={() => goto('landing')}
          >
            Back to home
          </button>
        </div>
      </main>
    </div>
  )
}

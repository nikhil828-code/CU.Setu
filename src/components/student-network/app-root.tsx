'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { AppShell } from '@/components/student-network/app-shell'
import { BrandMark } from '@/components/student-network/brand-mark'
import { CollabHubView } from '@/components/student-network/collab-hub-view'
import { ConnectionsView } from '@/components/student-network/connections-view'
import { NetworkCursor } from '@/components/student-network/cursor-network'
import { DiscoverView } from '@/components/student-network/discover-view'
import { DsaPlaygroundView } from '@/components/student-network/dsa-playground-view'
import { FeedView } from '@/components/student-network/feed-view'
import { IntroSplash } from '@/components/student-network/intro-splash'
import { LandingView } from '@/components/student-network/landing-view'
import { LoginView } from '@/components/student-network/login-view'
import { NetworkExplorerView } from '@/components/student-network/network-explorer-view'
import { NotificationsView } from '@/components/student-network/notifications-view'
import { ProfileView } from '@/components/student-network/profile-view'
import { RegisterView } from '@/components/student-network/register-view'
import { RequestsView } from '@/components/student-network/requests-view'
import { SearchView } from '@/components/student-network/search-view'
import { ShowcaseView } from '@/components/student-network/showcase-view'
import { SkillAnalyticsView } from '@/components/student-network/skill-analytics-view'
import { ApiError, apiFetch } from '@/lib/api'
import type { UserSummary } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0F1F46]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <BrandMark className="h-20 w-auto" />
      </motion.div>
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="size-2 animate-pulse rounded-full bg-amber-400" aria-hidden="true" />
        Connecting to your network…
        <span className="sr-only">CU.Setu is loading</span>
      </div>
    </div>
  )
}

function AppRootInner() {
  const me = useAppStore((s) => s.me)
  const view = useAppStore((s) => s.view)
  const [booted, setBooted] = useState(false)

  // Official intro animation: plays ONCE per browser session (skipped when
  // the visitor prefers reduced motion). The app keeps booting underneath,
  // so the landing page is preloaded while the video runs.
  useEffect(() => {
    let played = false
    try {
      played = sessionStorage.getItem('cu-setu-intro-played') === '1'
    } catch {
      played = false
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!played && !reduced) {
      useAppStore.getState().replayIntro()
    }
  }, [])

  // Auth bootstrap: restore the session (if any) before rendering a view.
  useEffect(() => {
    let cancelled = false
    apiFetch<{ user: UserSummary }>('/auth/me')
      .then(({ user }) => {
        if (cancelled) return
        useAppStore.getState().setMe(user)
        useAppStore.getState().goto('feed')
      })
      .catch(() => {
        // Not authenticated — the landing view is the default.
      })
      .finally(() => {
        if (!cancelled) setBooted(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!booted) return <SplashScreen />

  let content: React.ReactNode
  if (!me) {
    if (view === 'login') content = <LoginView />
    else if (view === 'register') content = <RegisterView />
    else content = <LandingView />
  } else {
    let inner: React.ReactNode
    switch (view) {
      case 'profile':
        inner = <ProfileView />
        break
      case 'connections':
        inner = <ConnectionsView />
        break
      case 'requests':
        inner = <RequestsView />
        break
      case 'discover':
        inner = <DiscoverView />
        break
      case 'search':
        inner = <SearchView />
        break
      case 'network':
        inner = <NetworkExplorerView />
        break
      case 'collab':
        inner = <CollabHubView />
        break
      case 'playground':
        inner = <DsaPlaygroundView />
        break
      case 'showcase':
        inner = <ShowcaseView />
        break
      case 'analytics':
        inner = <SkillAnalyticsView />
        break
      case 'notifications':
        inner = <NotificationsView />
        break
      default:
        inner = <FeedView />
    }
    content = <AppShell>{inner}</AppShell>
  }

  return (
    <motion.div
      key={`${view}-${me?.username ?? 'guest'}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {content}
    </motion.div>
  )
}

export function AppRoot() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false
              }
              return failureCount < 2
            },
            staleTime: 10_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  const introVisible = useAppStore((s) => s.introVisible)

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkCursor />
      {introVisible ? <IntroSplash /> : null}
      <AppRootInner />
    </QueryClientProvider>
  )
}

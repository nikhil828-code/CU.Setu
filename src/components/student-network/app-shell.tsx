'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  Compass,
  Home,
  LogOut,
  Search,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { apiFetch } from '@/lib/api'
import type { NotificationItem, RequestItem, SentRequestItem } from '@/lib/types'
import { useAppStore, type View } from '@/store/app-store'
import { cn } from '@/lib/utils'

interface NavItem {
  key: string
  label: string
  icon: LucideIcon
  view: View
  badge?: number
  navigate: () => void
}

function CountBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-w-5 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-600 px-1.5 py-0.5 text-[11px] font-semibold leading-none text-white tabular-nums',
        className,
      )}
    >
      {value > 99 ? '99+' : value}
    </span>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useAppStore((s) => s.me)
  const view = useAppStore((s) => s.view)
  const profileTarget = useAppStore((s) => s.profileTarget)
  const goto = useAppStore((s) => s.goto)
  const openProfile = useAppStore((s) => s.openProfile)
  const logoutLocal = useAppStore((s) => s.logoutLocal)
  const queryClient = useQueryClient()

  // Poll notifications for the unread badge (and keep the view fresh).
  const { data: notifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      apiFetch<{ notifications: NotificationItem[]; unread: number }>('/notifications'),
    refetchInterval: 30_000,
  })
  const { data: requestsData } = useQuery({
    queryKey: ['requests'],
    queryFn: () =>
      apiFetch<{ received: RequestItem[]; sent: SentRequestItem[] }>('/requests'),
    refetchInterval: 60_000,
  })

  const unread = notifications?.unread ?? 0
  const pendingTotal =
    (requestsData?.received.length ?? 0) + (requestsData?.sent.length ?? 0)

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      queryClient.clear()
      logoutLocal()
      toast({ title: 'Logged out', description: 'See you back on campus soon.' })
    },
    onError: () => {
      // Log out locally even if the server call failed.
      queryClient.clear()
      logoutLocal()
    },
  })

  if (!me) return null

  const navItems: NavItem[] = [
    {
      key: 'feed',
      label: 'Home',
      icon: Home,
      view: 'feed',
      navigate: () => goto('feed'),
    },
    {
      key: 'profile',
      label: 'My Profile',
      icon: UserRound,
      view: 'profile',
      navigate: () => openProfile(me.username),
    },
    {
      key: 'connections',
      label: 'Connections',
      icon: Users,
      view: 'connections',
      navigate: () => goto('connections'),
    },
    {
      key: 'requests',
      label: 'Requests',
      icon: UserPlus,
      view: 'requests',
      badge: pendingTotal,
      navigate: () => goto('requests'),
    },
    {
      key: 'discover',
      label: 'Discover',
      icon: Compass,
      view: 'discover',
      navigate: () => goto('discover'),
    },
    {
      key: 'search',
      label: 'Search',
      icon: Search,
      view: 'search',
      navigate: () => goto('search'),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      icon: Bell,
      view: 'notifications',
      badge: unread,
      navigate: () => goto('notifications'),
    },
  ]

  const isActive = (item: NavItem) =>
    view === item.view && (item.view !== 'profile' || profileTarget === me.username)

  const tabItems = navItems.filter((item) =>
    ['feed', 'discover', 'search', 'requests', 'profile'].includes(item.view),
  )

  return (
    <div className="min-h-screen bg-[#F4F6FB]">
      {/* Desktop sidebar — navy lifted one shade lighter than before */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-[#0F1F46] lg:flex">
        {/* Brand band: a dimmer, lower shade hugs the logo so the glowing
            mark stands out against it. */}
        <div className="relative flex items-center gap-2.5 overflow-hidden border-b border-white/10 px-5 py-5">
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[#0A1631]"
          />
          <span
            aria-hidden="true"
            className="absolute -left-8 top-1/2 size-28 -translate-y-1/2 rounded-full bg-amber-500/15 blur-2xl"
          />
          <span
            aria-hidden="true"
            className="absolute -right-10 top-0 size-24 translate-y-1/2 rounded-full bg-blue-500/10 blur-2xl"
          />
          <BrandMark className="relative h-9 w-auto" />
          <span className="relative text-lg font-semibold text-white">CU.Setu</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Primary">
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.navigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                )}
              >
                {active ? (
                  <span
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-amber-400 to-orange-600"
                    aria-hidden="true"
                  />
                ) : null}
                <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && item.badge > 0 ? (
                  <CountBadge value={item.badge} />
                ) : null}
              </button>
            )
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <UserAvatar username={me.username} fullName={me.full_name} avatarUrl={me.avatar_url} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{me.full_name}</p>
              <p className="truncate text-xs text-slate-400">@{me.username}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="w-full justify-start gap-2 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size="16" aria-hidden="true" />
            {logoutMutation.isPending ? 'Logging out…' : 'Log out'}
          </Button>
        </div>
      </aside>

      {/* Mobile top bar — same lifted navy, dimmer band behind the logo */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between overflow-hidden border-b border-white/10 bg-[#0F1F46] px-4 lg:hidden">
        <button
          type="button"
          onClick={() => goto('feed')}
          className="relative flex items-center gap-2"
          aria-label="CU.Setu home"
        >
          <span
            aria-hidden="true"
            className="absolute -left-4 -top-4 size-24 rounded-full bg-[#0A1631] blur-lg"
          />
          <BrandMark className="relative h-7 w-auto" />
          <span className="relative text-base font-semibold text-white">CU.Setu</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goto('notifications')}
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative flex size-10 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Bell className="size-5" aria-hidden="true" />
            {unread > 0 ? (
              <span className="absolute right-0.5 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-600 px-1 text-[10px] font-semibold text-white tabular-nums">
                {unread > 9 ? '9+' : unread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => openProfile(me.username)}
            aria-label="Open my profile"
            className="ml-1 flex items-center rounded-full p-1"
          >
            <UserAvatar username={me.username} fullName={me.full_name} avatarUrl={me.avatar_url} size="sm" />
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="lg:pl-64">
        <main className="min-h-screen bg-[#F4F6FB] pb-24 lg:pb-10" id="main-content">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-5">
          {tabItems.map((item) => {
            const active = isActive(item)
            return (
              <button
                key={item.key}
                type="button"
                onClick={item.navigate}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors',
                  active ? 'text-orange-600' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="relative">
                  <item.icon className="size-5" aria-hidden="true" />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-orange-600 px-1 text-[9px] font-semibold text-white">
                        {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label === 'My Profile' ? 'Profile' : item.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

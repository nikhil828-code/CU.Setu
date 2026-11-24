import { create } from 'zustand'

import type { UserSummary } from '@/lib/types'

export type View =
  | 'landing'
  | 'login'
  | 'register'
  | 'feed'
  | 'profile'
  | 'connections'
  | 'requests'
  | 'discover'
  | 'search'
  | 'notifications'

interface AppState {
  me: UserSummary | null
  view: View
  /** Username whose profile is currently shown in the profile view. */
  profileTarget: string | null
  setMe: (me: UserSummary | null) => void
  goto: (view: View) => void
  openProfile: (username: string) => void
  logoutLocal: () => void
}

export const useAppStore = create<AppState>((set) => ({
  me: null,
  view: 'landing',
  profileTarget: null,
  setMe: (me) => set({ me }),
  goto: (view) => set({ view }),
  openProfile: (username) => set({ view: 'profile', profileTarget: username }),
  logoutLocal: () => set({ me: null, view: 'landing', profileTarget: null }),
}))

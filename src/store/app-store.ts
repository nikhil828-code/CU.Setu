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
  | 'network'
  | 'collab'
  | 'playground'
  | 'showcase'
  | 'analytics'

interface AppState {
  me: UserSummary | null
  view: View
  /** Username whose profile is currently shown in the profile view. */
  profileTarget: string | null
  /** Official intro animation overlay (once per session, or replayed). */
  introVisible: boolean
  setMe: (me: UserSummary | null) => void
  goto: (view: View) => void
  openProfile: (username: string) => void
  logoutLocal: () => void
  replayIntro: () => void
  introDone: () => void
}

export const useAppStore = create<AppState>((set) => ({
  me: null,
  view: 'landing',
  profileTarget: null,
  introVisible: false,
  setMe: (me) => set({ me }),
  goto: (view) => set({ view }),
  openProfile: (username) => set({ view: 'profile', profileTarget: username }),
  logoutLocal: () => set({ me: null, view: 'landing', profileTarget: null }),
  replayIntro: () => set({ introVisible: true }),
  introDone: () => {
    try {
      sessionStorage.setItem('cu-setu-intro-played', '1')
    } catch {
      // storage unavailable — the intro simply may replay next visit
    }
    set({ introVisible: false })
  },
}))

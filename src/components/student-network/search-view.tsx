'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Loader2, Search as SearchIcon, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { ConnectButton } from '@/components/student-network/connect-button'
import { EmptyState } from '@/components/student-network/empty-state'
import { SectionHeader } from '@/components/student-network/section-header'
import { UserAvatar } from '@/components/student-network/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/api'
import type { SearchItem } from '@/lib/types'
import { useAppStore } from '@/store/app-store'

const RELATIONSHIP_BADGES: Record<string, { label: string; className: string } | undefined> = {
  connected: {
    label: 'Connected',
    className: 'border-emerald-200 bg-emerald-50 font-medium text-emerald-700',
  },
  pending_out: {
    label: 'Request sent',
    className: 'border-amber-200 bg-amber-50 font-medium text-amber-700',
  },
  pending_in: {
    label: 'Wants to connect',
    className: 'border-amber-200 bg-amber-50 font-medium text-amber-700',
  },
}

export function SearchView() {
  const openProfile = useAppStore((s) => s.openProfile)
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounce the typed prefix by 250ms.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  const searchQuery = useQuery({
    queryKey: ['search', debounced],
    queryFn: () =>
      apiFetch<{ query: string; results: SearchItem[] }>(
        `/search?q=${encodeURIComponent(debounced)}`,
      ),
    enabled: debounced !== '',
    placeholderData: keepPreviousData,
  })

  const results = searchQuery.data?.results ?? []
  const showHint = debounced === '' && query.trim() === ''

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <SectionHeader
        title="Search"
        subtitle="Find students by name or username."
      />

      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search students by name or username…"
          aria-label="Search students"
          className="h-12 w-full rounded-xl border bg-white pl-10 pr-10 text-base shadow-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
        />
        {searchQuery.isFetching ? (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden="true"
          />
        ) : null}
      </div>

      <div className="mt-4">
        {showHint ? (
          <EmptyState
            icon={SearchIcon}
            title="Type to search"
            description="Prefix matching powered by a Trie — a few characters are enough."
          />
        ) : searchQuery.isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="shadow-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <Skeleton className="size-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded-md" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : results.length === 0 ? (
          <EmptyState
            icon={Users}
            title={`No students found for “${debounced}”`}
            description="Try another prefix — Trie search matches the start of names and usernames."
          />
        ) : (
          <ul className="space-y-3">
            {results.map((item) => {
              const badge = RELATIONSHIP_BADGES[item.relationship]
              return (
                <li key={item.username}>
                  <Card
                    className="cursor-pointer shadow-sm transition-shadow hover:shadow-md"
                    onClick={() => openProfile(item.username)}
                  >
                    <CardContent className="flex flex-wrap items-center gap-3 p-4 sm:flex-nowrap">
                      <UserAvatar
                        username={item.username}
                        fullName={item.full_name}
                        onClick={() => openProfile(item.username)}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openProfile(item.username)}
                            className="truncate text-left text-sm font-semibold hover:underline focus-visible:outline-none focus-visible:underline"
                          >
                            {item.full_name}
                          </button>
                          <span className="truncate text-xs text-muted-foreground">
                            @{item.username}
                          </span>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {item.programme || 'Student'}
                          {item.year ? ` · ${item.year}` : ''}
                          {item.mutual_count > 0 ? (
                            <span>
                              {item.mutual_count} mutual connection
                              {item.mutual_count === 1 ? '' : 's'}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex w-full items-center gap-2 sm:w-auto">
                        {badge ? (
                          <Badge variant="outline" className={badge.className}>
                            {badge.label}
                          </Badge>
                        ) : null}
                        <div onClick={(e) => e.stopPropagation()}>
                          <ConnectButton
                            username={item.username}
                            relationship={item.relationship}
                            size="sm"
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

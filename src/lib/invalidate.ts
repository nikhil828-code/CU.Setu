import type { QueryClient } from '@tanstack/react-query'

/**
 * Invalidate every query affected by a graph mutation (requests, posts,
 * likes, comments, profile edits). Query keys are prefix-matched, so
 * ['user'] also invalidates ['user', username].
 */
export function invalidateNetwork(queryClient: QueryClient): void {
  const roots = [
    'feed',
    'requests',
    'connections',
    'degrees',
    'recommendations',
    'notifications',
    'user',
    'user-posts',
    'search',
    'stats',
    'path',
  ]

  for (const root of roots) {
    queryClient.invalidateQueries({ queryKey: [root] })
  }
}

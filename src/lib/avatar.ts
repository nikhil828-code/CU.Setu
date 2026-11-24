/**
 * Deterministic avatar gradients + initials.
 *
 * The gradient is chosen by a small string hash of the username so it is
 * stable across renders and reloads — never random.
 */

const GRADIENTS: [string, string][] = [
  ['#2563EB', '#7C3AED'],
  ['#1E40AF', '#3B82F6'],
  ['#4F46E5', '#A78BFA'],
  ['#0EA5E9', '#6366F1'],
  ['#312E81', '#7C3AED'],
  ['#1D4ED8', '#8B5CF6'],
  ['#3730A3', '#60A5FA'],
  ['#4338CA', '#93C5FD'],
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function gradientFor(username: string): string {
  const pair = GRADIENTS[hashString(username) % GRADIENTS.length]
  return `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`
}

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  const first = parts[0].charAt(0)
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}

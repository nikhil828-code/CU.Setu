/**
 * Deterministic avatar gradients + initials.
 *
 * The gradient is chosen by a small string hash of the username so it is
 * stable across renders and reloads — never random. The palette mirrors the
 * CU.Setu logo: deep navy blues, glowing oranges and a few supportive teals.
 */

const GRADIENTS: [string, string][] = [
  ['#1D4ED8', '#F97316'], // navy -> orange (logo hero pairing)
  ['#B45309', '#FBBF24'], // burnt orange -> amber
  ['#0E7490', '#22D3EE'], // deep teal -> cyan
  ['#0A1128', '#2563EB'], // midnight navy -> royal blue
  ['#9A3412', '#FB923C'], // rust -> light orange
  ['#155E75', '#F97316'], // teal -> orange
  ['#1E3A8A', '#60A5FA'], // indigo navy -> sky
  ['#7C2D12', '#F59E0B'], // dark umber -> amber
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

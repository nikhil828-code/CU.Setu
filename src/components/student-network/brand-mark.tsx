'use client'

import { useId } from 'react'

/** CampusConnect brand mark — three connected nodes forming a network glyph. */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = `cc-brand-${useId()}`

  return (
    <svg
      viewBox="0 0 36 36"
      className={className}
      role="img"
      aria-label="CampusConnect logo"
      fill="none"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="30"
          x2="32"
          y2="6"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <path
        d="M10 26 L18 10 L26 26"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 26 L26 26"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="10" cy="26" r="4" fill={`url(#${gradientId})`} />
      <circle cx="18" cy="10" r="4" fill={`url(#${gradientId})`} />
      <circle cx="26" cy="26" r="4" fill={`url(#${gradientId})`} />
    </svg>
  )
}

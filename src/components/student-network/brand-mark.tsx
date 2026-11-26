'use client'

import { cn } from '@/lib/utils'

/**
 * CU.Setu brand logo — the official uploaded artwork.
 *
 * The artwork sits on a pure-black background, so on the dark navy surfaces
 * of the app we blend it with `mix-blend-screen`, which makes the black
 * backdrop disappear and lets the glowing blue + orange mark float directly
 * on the page. Falls back gracefully on any dark surface.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
     
    <img
      src="/cu-setu-logo.png"
      alt="CU.Setu logo"
      draggable={false}
      className={cn(
        'select-none object-contain mix-blend-screen',
        className,
      )}
    />
  )
}

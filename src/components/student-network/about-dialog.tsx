'use client'

/**
 * About CU.Setu — brand info + the "Replay Intro" entry point for the
 * official entry animation.
 */

import { Info, PlayCircle } from 'lucide-react'
import { useState } from 'react'

import { BrandMark } from '@/components/student-network/brand-mark'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/store/app-store'

const DSA_FACTS = [
  'Graph — the student network itself (adjacency lists)',
  'BFS — shortest paths & degrees of separation',
  'Trie — the live prefix search',
  'Heap — feed ordering & top-K rankings',
  'Hash maps — O(1) lookups & skill analytics',
]

export function AboutDialog({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const replayIntro = useAppStore((s) => s.replayIntro)

  return (
    <>
      <span onClick={() => setOpen(true)} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen(true) }}>
        {children}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-4 text-orange-600" aria-hidden="true" />
              About CU.Setu
            </DialogTitle>
            <DialogDescription>
              A bridge connecting the students of Chanakya University.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <BrandMark className="h-10 w-auto" />
            <div>
              <p className="text-sm font-semibold">
                CU.<span className="text-orange-600">Setu</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Bridging Students, Connecting Possibilities.
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>
              A Data Structures &amp; Algorithms mini project where every
              networking feature runs on a classic structure:
            </p>
            <ul className="space-y-1">
              {DSA_FACTS.map((fact) => (
                <li key={fact} className="flex items-start gap-2 text-xs">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
                  {fact}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between gap-2 border-t pt-3">
            <p className="self-center text-[11px] text-muted-foreground">
              Next.js · Flask · SQLite
            </p>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                setOpen(false)
                replayIntro()
              }}
            >
              <PlayCircle className="size-4" aria-hidden="true" />
              Replay intro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

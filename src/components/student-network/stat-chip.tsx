import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface StatChipProps {
  icon?: LucideIcon
  label: string
  value: number | string
  tone?: 'light' | 'dark'
  className?: string
}

export function StatChip({
  icon: Icon,
  label,
  value,
  tone = 'light',
  className,
}: StatChipProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3 py-2.5',
        tone === 'light' ? 'border-border bg-white' : 'border-white/10 bg-white/5',
        className,
      )}
    >
      {Icon ? (
        <Icon
          className={cn(
            'size-4 shrink-0',
            tone === 'light' ? 'text-[#2563EB]' : 'text-[#93C5FD]',
          )}
          aria-hidden="true"
        />
      ) : null}
      <div className="min-w-0">
        <div
          className={cn(
            'text-lg font-semibold leading-none tabular-nums',
            tone === 'light' ? 'text-foreground' : 'text-white',
          )}
        >
          {value}
        </div>
        <div
          className={cn(
            'mt-1 text-xs leading-none',
            tone === 'light' ? 'text-muted-foreground' : 'text-slate-400',
          )}
        >
          {label}
        </div>
      </div>
    </div>
  )
}

import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Plan 019 — KPI tile. Big tabular number, small label, optional hint line
 * and a week-over-week delta. `positiveIsGood=false` flips the delta color
 * for metrics where up is bad (e.g. integrity flags).
 */
export function StatCard({
  label,
  value,
  suffix,
  hint,
  icon: Icon,
  delta,
  tone = 'default',
}: {
  label: string
  value: string | number | null
  suffix?: string
  hint?: string
  icon?: LucideIcon
  delta?: { value: number; positiveIsGood?: boolean; label?: string } | null
  tone?: 'default' | 'attention'
}) {
  const empty = value === null || value === undefined
  return (
    <div
      className={cn(
        'siq-card flex min-w-0 flex-col gap-3 p-5',
        tone === 'attention' && 'border-warning/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground truncate text-[13px] font-medium">{label}</p>
        {Icon ? (
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg',
              tone === 'attention' ? 'bg-warning/10 text-warning' : 'bg-accent text-primary',
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
      </div>
      <p className="font-display text-[28px] leading-none font-semibold tracking-tight">
        {empty ? <span className="text-muted-foreground">—</span> : value}
        {!empty && suffix ? (
          <span className="text-muted-foreground ml-0.5 text-base font-medium">{suffix}</span>
        ) : null}
      </p>
      <div className="flex min-h-5 items-center gap-2 text-xs">
        {delta ? <Delta {...delta} /> : null}
        {hint ? <span className="text-muted-foreground truncate">{hint}</span> : null}
      </div>
    </div>
  )
}

function Delta({
  value,
  positiveIsGood = true,
  label,
}: {
  value: number
  positiveIsGood?: boolean
  label?: string
}) {
  const good = value === 0 ? null : value > 0 === positiveIsGood
  const Icon = value > 0 ? ArrowUpRight : value < 0 ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
        good === null && 'bg-muted text-muted-foreground',
        good === true && 'bg-success/10 text-success',
        good === false && 'bg-destructive/10 text-destructive',
      )}
    >
      <Icon className="size-3" aria-hidden />
      {value > 0 ? '+' : ''}
      {value}
      {label ? ` ${label}` : ''}
    </span>
  )
}

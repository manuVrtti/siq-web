import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import type { CompetencyTier, CompetencyTrend } from '@prisma/client'

import { cn } from '@/lib/utils'

/**
 * Plan 026/027 — shared tier + trend visuals. Strength-first wording: the
 * labels describe where to grow, never "fail".
 */

export const TIER_STYLE: Record<CompetencyTier, { label: string; bar: string; ring: string; text: string; chip: string }> = {
  STRONG: { label: 'Strong', bar: 'bg-success', ring: 'stroke-success', text: 'text-success', chip: 'bg-success/12 text-success' },
  ON_TRACK: { label: 'On track', bar: 'bg-primary', ring: 'stroke-primary', text: 'text-primary', chip: 'bg-primary/10 text-primary' },
  NEEDS_WORK: { label: 'Needs work', bar: 'bg-warning', ring: 'stroke-warning', text: 'text-warning', chip: 'bg-warning/15 text-warning' },
  CRITICAL_GAP: { label: 'Focus here', bar: 'bg-destructive', ring: 'stroke-destructive', text: 'text-destructive', chip: 'bg-destructive/10 text-destructive' },
}

export function TierBadge({ tier, className }: { tier: CompetencyTier; className?: string }) {
  const t = TIER_STYLE[tier]
  return <span className={cn('inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap', t.chip, className)}>{t.label}</span>
}

export function TrendIndicator({ trend, compact = false }: { trend: CompetencyTrend; compact?: boolean }) {
  if (trend === 'INSUFFICIENT_DATA') {
    return compact ? null : (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
        <Minus className="size-3" aria-hidden /> One test so far
      </span>
    )
  }
  const map = {
    IMPROVING: { Icon: ArrowUpRight, text: 'Improving', cls: 'text-success' },
    STABLE: { Icon: ArrowRight, text: 'Steady', cls: 'text-muted-foreground' },
    DECLINING: { Icon: ArrowDownRight, text: 'Slipping', cls: 'text-warning' },
  } as const
  const m = map[trend]
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-medium whitespace-nowrap', m.cls)} title={m.text}>
      <m.Icon className="size-3.5" aria-hidden />
      {compact ? <span className="sr-only">{m.text}</span> : m.text}
    </span>
  )
}

/** Gentle cohort framing: never a raw rank. */
export function cohortPhrase(vs: { belowP25: boolean; aboveP75: boolean; cohort: string } | null) {
  if (!vs) return null
  const who =
    vs.cohort === 'DEPARTMENT_BATCH' ? 'your batch in your department' : vs.cohort === 'DEPARTMENT' ? 'your department' : vs.cohort === 'BATCH' ? 'your batch' : 'your college'
  if (vs.aboveP75) return { text: `Ahead of most of ${who}`, cls: 'text-success' }
  if (vs.belowP25) return { text: `Room to catch up with ${who}`, cls: 'text-warning' }
  return { text: `In line with ${who}`, cls: 'text-muted-foreground' }
}

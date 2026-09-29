import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Plan 019 — small building blocks shared by both dashboard variants.
 */

export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string
  title: string
  subtitle: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="siq-eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight sm:text-[32px]">
          {title}
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Initials({ name, email }: { name: string | null; email: string | null }) {
  const source = name?.trim() || email || '?'
  const parts = source.split(/\s+/)
  const text =
    parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : source.slice(0, 2)
  return (
    <span className="bg-accent text-accent-foreground grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold uppercase">
      {text}
    </span>
  )
}

export function StatusPill({
  status,
  percentage,
  passed,
}: {
  status: 'GRADED' | 'PENDING_REVIEW' | null
  percentage?: number | null
  passed?: boolean | null
}) {
  if (status === null) return <Pill tone="muted">Submitted</Pill>
  if (status === 'PENDING_REVIEW') return <Pill tone="warning">Pending review</Pill>
  const pct = percentage === null || percentage === undefined ? null : Math.round(percentage)
  if (passed === true) return <Pill tone="success">{pct !== null ? `${pct}% · passed` : 'Passed'}</Pill>
  if (passed === false)
    return <Pill tone="danger">{pct !== null ? `${pct}% · not passed` : 'Not passed'}</Pill>
  return <Pill tone="info">{pct !== null ? `${pct}%` : 'Graded'}</Pill>
}

export function Pill({
  tone,
  children,
}: {
  tone: 'muted' | 'info' | 'success' | 'warning' | 'danger'
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'siq-numeric inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        tone === 'muted' && 'bg-muted text-muted-foreground',
        tone === 'info' && 'bg-accent text-accent-foreground',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'warning' && 'bg-warning/10 text-warning',
        tone === 'danger' && 'bg-destructive/10 text-destructive',
      )}
    >
      {children}
    </span>
  )
}

/** Compact empty state for use inside a Panel (not a full-page EmptyState). */
export function PanelEmpty({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <span className="bg-accent text-primary grid size-10 place-items-center rounded-xl">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {body ? <p className="text-muted-foreground max-w-xs text-xs">{body}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

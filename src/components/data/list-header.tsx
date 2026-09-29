import type { ReactNode } from 'react'

/**
 * Plan 019 Phase 3 — header for list pages. Same type scale as the
 * dashboard hero so moving between pages doesn't jump sizes.
 */
export function ListHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode
  title: string
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="siq-eyebrow mb-2">{eyebrow}</div> : null}
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-1.5 text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

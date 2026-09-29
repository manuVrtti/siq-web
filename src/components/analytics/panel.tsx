import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * Plan 019 — the card every dashboard section sits in. Eyebrow + title on the
 * left, optional action on the right, content below. One component so every
 * panel on every analytics page has identical rhythm.
 */
export function Panel({
  eyebrow,
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  eyebrow?: string
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section className={cn('siq-card flex min-w-0 flex-col', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          {eyebrow ? <p className="siq-eyebrow mb-1">{eyebrow}</p> : null}
          <h2 className="truncate text-[15px] font-semibold">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn('flex-1 px-5 pt-4 pb-5', bodyClassName)}>{children}</div>
    </section>
  )
}

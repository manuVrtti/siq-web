import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Plan 008 — placeholder for a page with no data yet.
 *
 * Says what would be here and how to create the first one, rather than
 * leaving a blank screen that reads as broken.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-16 text-center">
      {Icon && <Icon className="text-muted-foreground size-8" aria-hidden />}
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}

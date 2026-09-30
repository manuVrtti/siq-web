import type { LucideIcon } from 'lucide-react'

/** Header for the student tabs: icon tile, title, one line of context. */
export function PageIntro({
  icon: Icon,
  title,
  subtitle,
  aside,
}: {
  icon: LucideIcon
  title: string
  subtitle: string
  aside?: React.ReactNode
}) {
  return (
    <div className="siq-rise flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-4">
        <span className="bg-primary text-primary-foreground grid size-12 shrink-0 place-items-center rounded-2xl shadow-[var(--shadow-primary)]">
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-[28px]">{title}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{subtitle}</p>
        </div>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  )
}

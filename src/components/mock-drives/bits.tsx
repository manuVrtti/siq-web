import { cn } from '@/lib/utils'

export const DRIVE_STATUS: Record<string, { label: string; tone: 'muted' | 'info' | 'success' | 'warning' | 'danger' }> = {
  DRAFT: { label: 'Draft', tone: 'muted' },
  SCHEDULED: { label: 'Scheduled', tone: 'info' },
  REGISTRATION_OPEN: { label: 'Registration open', tone: 'success' },
  IN_PROGRESS: { label: 'In progress', tone: 'warning' },
  COMPLETED: { label: 'Completed', tone: 'info' },
  ARCHIVED: { label: 'Archived', tone: 'muted' },
}

/** Employer logo, or a monogram when there isn't one. */
export function EmployerMark({ name, logo, className }: { name: string; logo: string | null; className?: string }) {
  if (logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={logo} alt="" className={cn('size-12 shrink-0 rounded-xl border bg-white object-contain p-1', className)} />
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return (
    <span className={cn('from-primary to-primary/70 text-primary-foreground grid size-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold', className)}>
      {initials || 'M'}
    </span>
  )
}

export const fmtDate = (d: Date | string | null) =>
  d ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(d)) : null

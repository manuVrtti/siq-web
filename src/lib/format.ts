/**
 * Plan 019 — display formatting. Everything renders in IST: the users are at
 * Indian colleges, and a server running in UTC (Vercel bom1 still reports
 * UTC) would otherwise greet someone "Good evening" at 10:30 in the morning.
 * Built on Intl — no date library needed.
 */

const TZ = 'Asia/Kolkata'

export function istHour(date: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-IN', { hour: 'numeric', hour12: false, timeZone: TZ }).format(date),
  )
}

export function greeting(date: Date = new Date()): string {
  const h = istHour(date)
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/** "Monday, 29 September" */
export function longDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TZ,
  }).format(date)
}

/** "29 Sep, 4:30 pm" */
export function shortDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  }).format(date)
}

/** "just now", "12m ago", "3h ago", "2d ago", else a short date. */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.round((now.getTime() - date.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 7) return `${d}d ago`
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: TZ }).format(
    date,
  )
}

export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0]
  return first || null
}

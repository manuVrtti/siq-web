'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRight, CalendarClock, CheckCircle2, Clock, ClipboardCheck, Hourglass, ListChecks, XCircle } from 'lucide-react'

import { StatusPill } from '@/components/dashboard/bits'
import { Countdown } from '@/components/motion/animated'
import { cn } from '@/lib/utils'

/**
 * Student Assessments tab — every exam assigned in this workspace, filtered
 * client-side (the list is small: tens, not thousands). Each card carries
 * exactly one next action for its state.
 */

export type BoardItem = {
  id: string
  token: string
  bucket: 'inProgress' | 'open' | 'upcoming' | 'done' | 'missed'
  title: string
  description: string | null
  durationMinutes: number
  questions: number
  startAt: string | null
  endAt: string | null
  submittedAt: string | null
  result: { id: string; status: 'GRADED' | 'PENDING_REVIEW' | 'SUPERSEDED'; percentage: number; passed: boolean | null } | null
}

const TABS = [
  { key: 'todo', label: 'To do', buckets: ['inProgress', 'open'] },
  { key: 'upcoming', label: 'Upcoming', buckets: ['upcoming'] },
  { key: 'done', label: 'Completed', buckets: ['done'] },
  { key: 'missed', label: 'Missed', buckets: ['missed'] },
  { key: 'all', label: 'All', buckets: ['inProgress', 'open', 'upcoming', 'done', 'missed'] },
] as const
type TabKey = (typeof TABS)[number]['key']

const fmt = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(
    new Date(iso),
  )

export function AssessmentsBoard({ items, nowIso, initialTab }: { items: BoardItem[]; nowIso: string; initialTab?: string }) {
  const counts = Object.fromEntries(
    TABS.map((t) => [t.key, items.filter((i) => (t.buckets as readonly string[]).includes(i.bucket)).length]),
  ) as Record<TabKey, number>
  // Land on the first tab that has something in it.
  const fallback = (TABS.find((t) => counts[t.key] > 0)?.key ?? 'todo') as TabKey
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : fallback)

  const active = TABS.find((t) => t.key === tab)!
  const shown = items.filter((i) => (active.buckets as readonly string[]).includes(i.bucket))

  function select(key: TabKey) {
    setTab(key)
    // Keep the URL shareable without a server round-trip.
    const url = new URL(window.location.href)
    url.searchParams.set('tab', key)
    window.history.replaceState(null, '', url)
  }

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Filter assessments" className="bg-muted/70 flex w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => select(t.key)}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all',
              tab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            <span
              className={cn(
                'siq-numeric rounded-full px-1.5 text-[11px] font-semibold',
                tab === t.key ? 'bg-primary text-primary-foreground' : 'bg-background',
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyTab tab={tab} />
      ) : (
        <div key={tab} className="grid gap-4 md:grid-cols-2">
          {shown.map((item, i) => (
            <ExamCard key={item.id} item={item} nowIso={nowIso} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

const TONE: Record<BoardItem['bucket'], { stripe: string; label: string; icon: typeof Clock; chip: string }> = {
  inProgress: { stripe: 'bg-warning', label: 'In progress', icon: Hourglass, chip: 'bg-warning/10 text-warning' },
  open: { stripe: 'bg-primary', label: 'Open now', icon: ClipboardCheck, chip: 'bg-accent text-primary' },
  upcoming: { stripe: 'bg-primary/40', label: 'Upcoming', icon: CalendarClock, chip: 'bg-muted text-muted-foreground' },
  done: { stripe: 'bg-success', label: 'Completed', icon: CheckCircle2, chip: 'bg-success/10 text-success' },
  missed: { stripe: 'bg-destructive/60', label: 'Missed', icon: XCircle, chip: 'bg-destructive/10 text-destructive' },
}

function ExamCard({ item, nowIso, index }: { item: BoardItem; nowIso: string; index: number }) {
  const tone = TONE[item.bucket]
  const StatusIcon = tone.icon

  return (
    <article
      className="siq-card siq-rise relative flex flex-col overflow-hidden"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', tone.stripe)} aria-hidden />
      <div className="flex flex-1 flex-col gap-4 p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold', tone.chip)}>
              <StatusIcon className="size-3" aria-hidden />
              {tone.label}
            </span>
            <h3 className="mt-2 line-clamp-2 text-base leading-snug font-semibold">{item.title}</h3>
            {item.description ? <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">{item.description}</p> : null}
          </div>
          {item.bucket === 'done' && item.result ? (
            <StatusPill status={item.result.status} percentage={item.result.percentage} passed={item.result.passed} />
          ) : null}
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> {item.durationMinutes} min
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ListChecks className="size-3.5" aria-hidden /> {item.questions} questions
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-3.5" aria-hidden />
            {item.bucket === 'done' && item.submittedAt
              ? `Submitted ${fmt(item.submittedAt)}`
              : item.bucket === 'upcoming' && item.startAt
                ? `Opens ${fmt(item.startAt)}`
                : item.endAt
                  ? `${item.bucket === 'missed' ? 'Closed' : 'Closes'} ${fmt(item.endAt)}`
                  : 'No deadline'}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4">
          <Footer item={item} nowIso={nowIso} />
        </div>
      </div>
    </article>
  )
}

function Footer({ item, nowIso }: { item: BoardItem; nowIso: string }) {
  const primary =
    'group bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0'
  const quiet = 'group text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline'

  switch (item.bucket) {
    case 'inProgress':
    case 'open':
      return (
        <>
          <span className="text-muted-foreground text-xs">
            {item.bucket === 'inProgress' ? 'Your answers are saved' : 'Opens in the secure browser'}
          </span>
          <Link href={`/exam/${item.token}`} className={primary}>
            {item.bucket === 'inProgress' ? 'Resume' : 'Start exam'}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </>
      )
    case 'upcoming':
      return (
        <>
          <span className="text-muted-foreground text-xs">Opens in</span>
          <Countdown to={item.startAt!} nowIso={nowIso} variant="card" />
        </>
      )
    case 'done':
      return item.result ? (
        <>
          <span className="text-muted-foreground text-xs">
            {item.result.status === 'PENDING_REVIEW' ? 'Being graded — check back soon' : 'Your breakdown is ready'}
          </span>
          <Link href={`/my-results/${item.result.id}`} className={quiet}>
            View result <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </>
      ) : (
        <span className="text-muted-foreground text-xs">Submitted — your result will appear here.</span>
      )
    case 'missed':
      return <span className="text-muted-foreground text-xs">This exam closed before it was submitted.</span>
  }
}

function EmptyTab({ tab }: { tab: TabKey }) {
  const copy: Record<TabKey, { title: string; body: string }> = {
    todo: { title: 'Nothing to do right now', body: 'When your placement cell assigns an exam, it appears here.' },
    upcoming: { title: 'Nothing scheduled', body: 'Exams with a future start time show up here with a countdown.' },
    done: { title: 'No completed exams yet', body: 'Once you submit an exam, it moves here with your score.' },
    missed: { title: 'Nothing missed', body: 'Keep it that way — exams that close before you submit land here.' },
    all: { title: 'No exams yet', body: 'Your placement cell hasn’t assigned any exams in this workspace.' },
  }
  return (
    <div className="siq-card flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className="bg-accent text-primary grid size-12 place-items-center rounded-2xl">
        <ClipboardCheck className="size-6" aria-hidden />
      </span>
      <p className="text-base font-semibold">{copy[tab].title}</p>
      <p className="text-muted-foreground max-w-sm text-sm">{copy[tab].body}</p>
    </div>
  )
}

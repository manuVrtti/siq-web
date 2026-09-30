import Link from 'next/link'
import { ArrowRight, Sparkles, Target, TrendingUp, Users } from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { PanelEmpty } from '@/components/dashboard/bits'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Student dashboard v2 panels (ABtalks-inspired): a profile nudge, how you
 * compare with your cohort, and your strongest / weakest topics.
 */

export function ProfileNudge({
  percent,
  next,
  href,
}: {
  percent: number
  next: { key: string; label: string; section: string }[]
  href: string
}) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <section className="siq-card border-primary/25 bg-primary/[0.03] flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div className="relative size-14 shrink-0">
        <svg viewBox="0 0 56 56" className="size-14 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth="5" />
          <circle
            cx="28"
            cy="28"
            r={r}
            fill="none"
            stroke="var(--primary)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (percent / 100) * c}
          />
        </svg>
        <span className="siq-numeric absolute inset-0 grid place-items-center text-xs font-semibold">{percent}%</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          {percent < 50 ? 'Your profile is how recruiters find you — finish it' : 'Almost there — a stronger profile gets shortlisted more'}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Next: {next.map((n) => n.label.toLowerCase()).join(' · ')}
        </p>
      </div>
      <Button render={<Link href={`${href}?section=${next[0]?.section ?? 'basics'}`} />}>
        Complete profile
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </section>
  )
}

export function StandingPanel({
  standing,
}: {
  standing: { resultId: string; title: string; percentage: number; betterThan: number; cohort: number }[]
}) {
  return (
    <Panel eyebrow="Standing" title="How you compare">
      {standing.length === 0 ? (
        <PanelEmpty
          icon={Users}
          title="Not enough results yet"
          body="Once at least 5 people have been graded on an exam you took, you'll see where you stand."
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {standing.map((s) => (
            <li key={s.resultId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link href={`/my-results/${s.resultId}`} className="hover:text-primary min-w-0 truncate font-medium">
                  {s.title}
                </Link>
                <span className="siq-numeric shrink-0 text-xs">
                  <span className="text-foreground font-semibold">{s.percentage}%</span>
                  <span className="text-muted-foreground"> · {s.cohort} took it</span>
                </span>
              </div>
              <div className="bg-muted relative h-2 rounded-full">
                <div className="bg-primary h-full rounded-full" style={{ width: `${Math.max(2, s.betterThan)}%` }} />
              </div>
              <p className="text-muted-foreground text-xs">
                {s.betterThan >= 50 ? (
                  <>
                    Better than <span className="text-foreground font-medium">{s.betterThan}%</span> of candidates
                  </>
                ) : (
                  <>
                    Top <span className="text-foreground font-medium">{100 - s.betterThan}%</span> — room to climb
                  </>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function TopicsPanel({
  strengths,
  focus,
}: {
  strengths: { tag: string; percentage: number; questions: number }[]
  focus: { tag: string; percentage: number; questions: number }[]
}) {
  if (strengths.length === 0) {
    return (
      <Panel eyebrow="Topics" title="Strengths & focus areas">
        <PanelEmpty
          icon={Target}
          title="Not enough data yet"
          body="After a few graded exams we'll show the topics you're strongest in and the ones worth practising."
        />
      </Panel>
    )
  }
  return (
    <Panel eyebrow="Topics" title="Strengths & focus areas">
      <div className="grid gap-5 sm:grid-cols-2">
        <TopicList icon={TrendingUp} label="Strongest" items={strengths} tone="good" />
        {focus.length ? (
          <TopicList icon={Sparkles} label="Practise next" items={focus} tone="focus" />
        ) : (
          <p className="text-muted-foreground self-center text-sm">
            Answer questions across more topics to see what to practise next.
          </p>
        )}
      </div>
    </Panel>
  )
}

function TopicList({
  icon: Icon,
  label,
  items,
  tone,
}: {
  icon: typeof Target
  label: string
  items: { tag: string; percentage: number; questions: number }[]
  tone: 'good' | 'focus'
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', tone === 'good' ? 'text-success' : 'text-warning')}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((t) => (
          <li key={t.tag} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{t.tag}</span>
              <span className="siq-numeric text-xs">
                {t.percentage}%<span className="text-muted-foreground"> · {t.questions}q</span>
              </span>
            </div>
            <div className="bg-muted h-1.5 overflow-hidden rounded-full">
              <div
                className={cn('h-full rounded-full', tone === 'good' ? 'bg-success' : 'bg-warning')}
                style={{ width: `${t.percentage}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

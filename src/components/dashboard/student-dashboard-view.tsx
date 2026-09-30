import Link from 'next/link'
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  ListChecks,
  PartyPopper,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react'

import { TrendLine } from '@/components/analytics/trend-line'
import { StatusPill } from '@/components/dashboard/bits'
import { Bar, CountUp, Countdown, Ring } from '@/components/motion/animated'
import { cn } from '@/lib/utils'

/**
 * Student dashboard — pure view (all data via props). Split from the loader
 * so it can be reviewed with sample data in dev.
 *
 * Design intent (vs. the generic "grid of identical cards"):
 *   - ONE focal point: the next exam, on a solid brand surface, with a live
 *     countdown and a single primary action.
 *   - Progress as a ring + three facts, not four look-alike KPI tiles.
 *   - Everything clickable lifts; everything numeric animates in once.
 *   - Sections enter in a short stagger so the page reads top-down.
 */

export type StudentDashboardData = {
  firstName: string | null
  orgName: string
  slug: string
  nowIso: string
  greeting: string
  open: {
    id: string
    token: string
    status: 'INVITED' | 'STARTED' | 'SUBMITTED' | 'EXPIRED'
    title: string
    durationMinutes: number
    questions: number
    startAt: string | null
    endAt: string | null
  }[]
  completed: number
  pendingReview: number
  avgPercentage: number | null
  bestPercentage: number | null
  passed: number
  decided: number
  trend: { title: string; percentage: number }[]
  recent: { id: string; title: string; status: 'GRADED' | 'PENDING_REVIEW'; percentage: number; passed: boolean | null; createdAt: string }[]
  standing: { resultId: string; title: string; percentage: number; betterThan: number; cohort: number }[]
  strengths: { tag: string; percentage: number; questions: number }[]
  focus: { tag: string; percentage: number; questions: number }[]
  profile: { percent: number; next: { key: string; label: string; section: string }[] }
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(
    new Date(iso),
  )
const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(iso))

function rise(i: number) {
  return { className: 'siq-rise', style: { animationDelay: `${i * 70}ms` } }
}

export function StudentDashboardView({ data: d }: { data: StudentDashboardData }) {
  const next = d.open[0]
  const others = d.open.slice(1)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {/* ---- Hero: next exam + progress ----------------------------------- */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section
          {...rise(0)}
          className={cn(
            rise(0).className,
            'bg-primary text-primary-foreground relative overflow-hidden rounded-3xl p-6 shadow-[var(--shadow-primary)] sm:p-8',
          )}
          aria-label={next ? 'Your next exam' : 'Welcome'}
        >
          <div className="siq-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          <div className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex h-full flex-col">
            <p className="text-sm text-white/80">
              {d.greeting}
              {d.firstName ? `, ${d.firstName}` : ''}
            </p>

            {next ? (
              <>
                <p className="mt-6 text-xs font-semibold tracking-wider text-white/70 uppercase">
                  {next.status === 'STARTED' ? 'Continue where you left off' : 'Your next exam'}
                </p>
                <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">{next.title}</h1>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <Chip icon={Clock}>{next.durationMinutes} min</Chip>
                  <Chip icon={ListChecks}>{next.questions} questions</Chip>
                  {next.endAt ? <Chip icon={CalendarClock}>Closes {fmtDate(next.endAt)}</Chip> : null}
                </div>

                <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
                  {next.startAt && new Date(next.startAt) > new Date(d.nowIso) ? (
                    <div>
                      <p className="mb-2 text-xs text-white/75">Opens in</p>
                      <Countdown to={next.startAt} nowIso={d.nowIso} />
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium">
                      <span className="size-2 animate-pulse rounded-full bg-emerald-300" />
                      Open now
                    </span>
                  )}
                  <Link
                    href={`/exam/${next.token}`}
                    className="text-primary group inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0"
                  >
                    {next.status === 'STARTED' ? 'Resume exam' : 'Start exam'}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
                  You&apos;re all caught up
                </h1>
                <p className="mt-2 max-w-md text-sm text-white/80">
                  No exams are waiting at {d.orgName}. When your placement cell assigns one, it shows up here with a
                  countdown.
                </p>
                <div className="mt-auto pt-8">
                  <Link
                    href={`/${d.slug}/profile`}
                    className="text-primary group inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    Strengthen your profile
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>

        <section {...rise(1)} className="siq-card siq-rise flex flex-col gap-5 p-6" style={rise(1).style}>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">Your progress</h2>
            <Link href="/my-results" className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline">
              All results <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="flex items-center gap-5">
            <Ring percent={d.avgPercentage ?? 0} size={112} stroke={11}>
              <div className="text-center">
                <p className="font-display text-2xl leading-none font-semibold">
                  {d.avgPercentage === null ? '—' : <CountUp value={d.avgPercentage} decimals={0} suffix="%" />}
                </p>
                <p className="text-muted-foreground mt-1 text-[10px] tracking-wide uppercase">average</p>
              </div>
            </Ring>
            <dl className="grid flex-1 gap-3">
              <Fact icon={CheckCircle2} label="Exams done" value={d.completed} />
              <Fact icon={Trophy} label="Best score" value={d.bestPercentage === null ? '—' : `${Math.round(d.bestPercentage)}%`} />
              <Fact icon={Sparkles} label="Passed" value={d.decided ? `${d.passed} of ${d.decided}` : '—'} />
            </dl>
          </div>
          {d.pendingReview > 0 ? (
            <p className="bg-warning/10 text-warning rounded-xl px-3 py-2 text-xs font-medium">
              {d.pendingReview} result{d.pendingReview === 1 ? ' is' : 's are'} being graded — check back soon.
            </p>
          ) : null}
        </section>
      </div>

      {/* ---- Profile checklist ------------------------------------------ */}
      {d.profile.percent < 100 ? (
        <section {...rise(2)} className="siq-card siq-rise flex flex-col gap-4 p-5 sm:flex-row sm:items-center" style={rise(2).style}>
          <Ring percent={d.profile.percent} size={56} stroke={6}>
            <span className="siq-numeric text-xs font-semibold">{d.profile.percent}%</span>
          </Ring>
          <div className="min-w-0 sm:w-56">
            <p className="text-sm font-semibold">Complete your profile</p>
            <p className="text-muted-foreground text-xs">Recruiters shortlist from profiles. Each step takes a minute.</p>
          </div>
          <ul className="grid flex-1 gap-2 sm:grid-cols-3">
            {d.profile.next.map((n) => (
              <li key={n.key}>
                <Link
                  href={`/${d.slug}/profile?section=${n.section}`}
                  className="siq-lift group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm"
                >
                  <span className="truncate">{n.label}</span>
                  <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Also assigned ---------------------------------------------- */}
      {others.length > 0 ? (
        <section {...rise(3)} className="siq-rise flex flex-col gap-3" style={rise(3).style}>
          <h2 className="text-[15px] font-semibold">Also assigned</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((o) => (
              <Link key={o.id} href={`/exam/${o.token}`} className="siq-card siq-lift group flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold">{o.title}</p>
                  <ArrowUpRight className="text-muted-foreground group-hover:text-primary size-4 shrink-0 transition-colors" aria-hidden />
                </div>
                <p className="text-muted-foreground text-xs">
                  {o.durationMinutes} min · {o.questions} q{o.endAt ? ` · closes ${fmtShort(o.endAt)}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {d.completed === 0 && d.recent.length === 0 ? (
        <section {...rise(4)} className="siq-card siq-rise overflow-hidden" style={rise(4).style}>
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
            <div>
              <p className="text-primary text-sm font-semibold">Unlocks after your first exam</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Your insights live here</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                Once you finish an exam you&apos;ll see how you compare with other candidates, your strongest
                topics, what to practise next, and how your scores move over time.
              </p>
            </div>
            {/* A faded glimpse of what's coming — sample shapes, clearly not real data. */}
            <div aria-hidden className="relative grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border p-4">
                <p className="text-muted-foreground mb-3 text-xs font-medium">How you compare</p>
                {[82, 64, 47].map((w) => (
                  <div key={w} className="mb-2.5">
                    <div className="bg-muted mb-1 h-2 w-2/3 rounded" />
                    <div className="bg-muted h-2 overflow-hidden rounded-full">
                      <div className="bg-primary/25 h-full rounded-full" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border p-4">
                <p className="text-muted-foreground mb-3 text-xs font-medium">Strengths & focus</p>
                {[90, 72, 38].map((w, i) => (
                  <div key={w} className="mb-2.5">
                    <div className="bg-muted mb-1 h-2 w-1/2 rounded" />
                    <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                      <div className={i < 2 ? 'bg-success/30 h-full rounded-full' : 'bg-warning/30 h-full rounded-full'} style={{ width: `${w}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="to-card pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent" />
            </div>
          </div>
        </section>
      ) : (
        <>
      {/* ---- Standing + topics ------------------------------------------ */}
        <div className="grid gap-5 lg:grid-cols-2">
          <section {...rise(4)} className="siq-card siq-rise p-6" style={rise(4).style}>
            <div className="mb-5 flex items-center gap-2">
              <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
                <Users className="size-4" aria-hidden />
              </span>
              <h2 className="text-[15px] font-semibold">How you compare</h2>
            </div>
            {d.standing.length === 0 ? (
              <Empty text="Once 5 or more people are graded on an exam you took, you'll see where you stand." />
            ) : (
              <ul className="flex flex-col gap-5">
                {d.standing.map((s) => (
                  <li key={s.resultId}>
                    <Link href={`/my-results/${s.resultId}`} className="group block">
                      <div className="mb-2 flex items-baseline justify-between gap-3">
                        <span className="group-hover:text-primary truncate text-sm font-medium transition-colors">{s.title}</span>
                        <span className="siq-numeric shrink-0 text-sm font-semibold">{s.percentage}%</span>
                      </div>
                      <Bar percent={Math.max(3, s.betterThan)} />
                      <p className="text-muted-foreground mt-1.5 text-xs">
                        {s.betterThan >= 50 ? (
                          <>
                            Ahead of <b className="text-foreground">{s.betterThan}%</b> of {s.cohort} candidates
                          </>
                        ) : (
                          <>
                            {s.cohort} took it · <b className="text-foreground">top {100 - s.betterThan}%</b> — room to climb
                          </>
                        )}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
  
          <section {...rise(5)} className="siq-card siq-rise p-6" style={rise(5).style}>
            <div className="mb-5 flex items-center gap-2">
              <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
                <TrendingUp className="size-4" aria-hidden />
              </span>
              <h2 className="text-[15px] font-semibold">Strengths &amp; focus areas</h2>
            </div>
            {d.strengths.length === 0 ? (
              <Empty text="After a few graded exams you'll see the topics you're strongest in and what to practise next." />
            ) : (
              <div className="grid gap-6 sm:grid-cols-2">
                <TopicCol title="Strongest" tone="good" items={d.strengths} />
                {d.focus.length ? (
                  <TopicCol title="Practise next" tone="focus" items={d.focus} />
                ) : (
                  <p className="text-muted-foreground self-center text-sm">Answer questions across more topics to see what to practise.</p>
                )}
              </div>
            )}
          </section>
        </div>
  
        {/* ---- Trend + recent --------------------------------------------- */}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
          <section {...rise(6)} className="siq-card siq-rise p-6" style={rise(6).style}>
            <h2 className="mb-4 text-[15px] font-semibold">Scores over time</h2>
            <TrendLine
              points={d.trend.map((t) => ({ title: t.title, value: t.percentage }))}
              emptyText="Your progress chart starts after your first graded exam."
              valueLabel="score"
            />
          </section>
  
          <section {...rise(7)} className="siq-card siq-rise flex flex-col p-6" style={rise(7).style}>
            <h2 className="mb-3 text-[15px] font-semibold">Recent results</h2>
            {d.recent.length === 0 ? (
              <Empty text="Finished exams appear here." icon={FileText} />
            ) : (
              <ol className="relative flex flex-col">
                {d.recent.map((r, i) => (
                  <li key={r.id} className="relative pl-6">
                    {i < d.recent.length - 1 ? <span className="bg-border absolute top-5 bottom-0 left-[7px] w-px" aria-hidden /> : null}
                    <span
                      className={cn(
                        'absolute top-3 left-0 size-[15px] rounded-full border-2 border-white shadow-sm',
                        r.status === 'PENDING_REVIEW' ? 'bg-warning' : r.passed === false ? 'bg-destructive' : 'bg-primary',
                      )}
                      aria-hidden
                    />
                    <Link href={`/my-results/${r.id}`} className="hover:bg-muted/60 -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.title}</p>
                        <p className="text-muted-foreground text-xs">{fmtShort(r.createdAt)}</p>
                      </div>
                      <StatusPill status={r.status} percentage={r.percentage} passed={r.passed} />
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        </>
      )}
    </div>
  )
}

function Chip({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 font-medium backdrop-blur-sm">
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  )
}

function Fact({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground inline-flex items-center gap-2 text-sm">
        <Icon className="size-4" aria-hidden />
        {label}
      </dt>
      <dd className="siq-numeric text-sm font-semibold">{value}</dd>
    </div>
  )
}

function TopicCol({ title, tone, items }: { title: string; tone: 'good' | 'focus'; items: { tag: string; percentage: number; questions: number }[] }) {
  return (
    <div>
      <p className={cn('mb-3 text-xs font-semibold', tone === 'good' ? 'text-success' : 'text-warning')}>{title}</p>
      <ul className="flex flex-col gap-3.5">
        {items.map((t) => (
          <li key={t.tag}>
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-medium">{t.tag}</span>
              <span className="siq-numeric text-xs">{t.percentage}%</span>
            </div>
            <Bar percent={t.percentage} className="h-1.5" barClassName={tone === 'good' ? 'bg-success' : 'bg-warning'} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Empty({ text, icon: Icon = PartyPopper }: { text: string; icon?: typeof Clock }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-8 text-center">
      <Icon className="text-muted-foreground size-5" aria-hidden />
      <p className="text-muted-foreground max-w-xs text-sm">{text}</p>
    </div>
  )
}

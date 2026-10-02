import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, ArrowUpRight, LineChart, TrendingDown, TrendingUp, Users } from 'lucide-react'

import { TrendLine } from '@/components/analytics/trend-line'
import { StatusPill } from '@/components/dashboard/bits'
import { Bar, CountUp, Ring } from '@/components/motion/animated'
import { PageIntro } from '@/components/student/page-intro'
import { FocusAreas, StrengthsCard, TopicList } from '@/components/competency/strengths-weaknesses'
import { getStudentCompetencyView } from '@/services/competency/student-view'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { cn } from '@/lib/utils'
import {
  getStudentAssessments,
  getStudentInsights,
  getStudentOverview,
} from '@/services/analytics/candidate-analytics'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Analytics — SelectIQ' }

const fmtShort = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).format(d)

/** Mastery bands for the topic list. */
function band(p: number) {
  if (p >= 75) return { label: 'Strong', bar: 'bg-success', text: 'text-success' }
  if (p >= 50) return { label: 'Steady', bar: 'bg-primary', text: 'text-primary' }
  return { label: 'Practise', bar: 'bg-warning', text: 'text-warning' }
}

/**
 * Student Analytics tab — the long-form version of the dashboard's insight
 * cards: every topic (not just the top three), the full score history, and
 * an exam-by-exam breakdown. Own data only; membership is the gate.
 */
export default async function MyAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ compare?: string }>
}) {
  const { org: slug } = await params
  const compare = (await searchParams).compare === '1'
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user) notFound()

  const [o, insights, exams, view] = await Promise.all([
    getStudentOverview(org.id, user.id),
    getStudentInsights(org.id, user.id),
    getStudentAssessments(org.id, user.id),
    // Plan 027 — own data only: always the signed-in user's id.
    getStudentCompetencyView(user.id, org.id, { compare }),
  ])

  const graded = o.trend.length
  const delta = graded >= 2 ? o.trend[graded - 1]!.percentage - o.trend[0]!.percentage : null
  const passRate = o.decided ? Math.round((o.passed / o.decided) * 100) : null
  const standingById = new Map(insights.standing.map((s) => [s.resultId, s]))

  if (o.completed === 0 && graded === 0) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <PageIntro icon={LineChart} title="Analytics" subtitle="How you're doing, topic by topic and exam by exam." />
        <section className="siq-card siq-rise flex flex-col items-center gap-4 px-6 py-16 text-center">
          <Ring percent={0} size={96} stroke={9}>
            <span className="text-muted-foreground text-lg font-semibold">—</span>
          </Ring>
          <div>
            <h2 className="text-lg font-semibold">Your analytics start with your first exam</h2>
            <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
              After you submit an exam you&apos;ll see your score trend, how you compare with other candidates, and a
              topic-by-topic view of what to practise.
            </p>
          </div>
          <Link
            href={`/${slug}/my-assessments`}
            className="bg-primary text-primary-foreground group inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-transform hover:-translate-y-0.5"
          >
            See your assessments
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <PageIntro
        icon={LineChart}
        title="Analytics"
        subtitle={`${o.completed} exam${o.completed === 1 ? '' : 's'} completed at ${org.name}`}
      />

      {/* ---- Summary band ------------------------------------------------ */}
      <section className="siq-card siq-rise grid overflow-hidden sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '60ms' }}>
        <Metric label="Average score">
          <div className="flex items-center gap-3">
            <Ring percent={o.avgPercentage ?? 0} size={44} stroke={5} />
            <span className="font-display text-3xl font-semibold">
              {o.avgPercentage === null ? '—' : <CountUp value={o.avgPercentage} suffix="%" />}
            </span>
          </div>
        </Metric>
        <Metric label="Best score">
          <span className="font-display text-3xl font-semibold">
            {o.bestPercentage === null ? '—' : <CountUp value={o.bestPercentage} suffix="%" />}
          </span>
        </Metric>
        <Metric label="Pass rate" hint={o.decided ? `${o.passed} of ${o.decided} passed` : 'No pass marks set yet'}>
          <span className="font-display text-3xl font-semibold">
            {passRate === null ? '—' : <CountUp value={passRate} suffix="%" />}
          </span>
        </Metric>
        <Metric label="Since your first exam" hint={delta === null ? 'Needs two graded exams' : 'Change in score'}>
          {delta === null ? (
            <span className="font-display text-muted-foreground text-3xl font-semibold">—</span>
          ) : (
            <span
              className={cn(
                'font-display inline-flex items-center gap-1.5 text-3xl font-semibold',
                delta >= 0 ? 'text-success' : 'text-destructive',
              )}
            >
              {delta >= 0 ? <TrendingUp className="size-6" aria-hidden /> : <TrendingDown className="size-6" aria-hidden />}
              {delta > 0 ? '+' : ''}
              {Math.round(delta)}
              <span className="text-lg">pts</span>
            </span>
          )}
        </Metric>
      </section>
      {o.pendingReview > 0 ? (
        <p className="bg-warning/10 text-warning rounded-xl px-4 py-2.5 text-sm font-medium">
          {o.pendingReview} result{o.pendingReview === 1 ? ' is' : 's are'} still being graded and not counted yet.
        </p>
      ) : null}

      {/* ---- Trend + standing -------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <section className="siq-card siq-rise p-6" style={{ animationDelay: '120ms' }}>
          <h2 className="mb-4 text-[15px] font-semibold">Scores over time</h2>
          <TrendLine
            points={o.trend.map((t) => ({ title: t.title, value: t.percentage }))}
            emptyText="Your chart starts after your first graded exam."
            valueLabel="score"
          />
        </section>

        <section className="siq-card siq-rise p-6" style={{ animationDelay: '180ms' }}>
          <div className="mb-5 flex items-center gap-2">
            <span className="bg-accent text-primary grid size-8 place-items-center rounded-lg">
              <Users className="size-4" aria-hidden />
            </span>
            <h2 className="text-[15px] font-semibold">How you compare</h2>
          </div>
          {insights.standing.length === 0 ? (
            <p className="text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
              Once 5 or more people are graded on an exam you took, you&apos;ll see where you stand.
            </p>
          ) : (
            <ul className="flex flex-col gap-5">
              {insights.standing.map((s) => (
                <li key={s.resultId}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium">{s.title}</span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      ahead of <b className="text-foreground siq-numeric text-sm">{s.betterThan}%</b>
                    </span>
                  </div>
                  <Bar percent={Math.max(3, s.betterThan)} />
                  <p className="text-muted-foreground mt-1.5 text-xs">
                    You scored {s.percentage}% · {s.cohort} candidates
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- Strengths & weaknesses (plan 027) --------------------------- */}
      {view.hasProfile ? (
        <>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <FocusAreas view={view} slug={slug} />
            <StrengthsCard view={view} />
          </div>
          <TopicList view={view} slug={slug} compare={compare} />
        </>
      ) : null}

      {/* ---- Topic mastery (free-form tags; until tests are topic-tagged) -- */}
      {view.hasProfile ? null : (
      <section className="siq-card siq-rise p-6" style={{ animationDelay: '240ms' }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">Topic mastery</h2>
            <p className="text-muted-foreground text-xs">Share of marks earned per topic, across all your graded exams.</p>
          </div>
          <div className="flex gap-3 text-xs">
            {[80, 60, 30].map((p) => {
              const b = band(p)
              return (
                <span key={p} className="text-muted-foreground inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', b.bar)} aria-hidden />
                  {b.label}
                </span>
              )
            })}
          </div>
        </div>
        {insights.topics.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-dashed px-4 py-8 text-center text-sm">
            Topics appear once you&apos;ve answered at least 3 graded questions on them.
          </p>
        ) : (
          <ul className="grid gap-x-10 gap-y-4 md:grid-cols-2">
            {insights.topics.map((t) => {
              const b = band(t.percentage)
              return (
                <li key={t.tag}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{t.tag}</span>
                    <span className="shrink-0 text-xs">
                      <span className={cn('font-semibold', b.text)}>{b.label}</span>
                      <span className="text-muted-foreground siq-numeric">
                        {' '}
                        · {t.percentage}% · {t.questions} q
                      </span>
                    </span>
                  </div>
                  <Bar percent={t.percentage} barClassName={b.bar} />
                </li>
              )
            })}
          </ul>
        )}
      </section>
      )}

      {/* ---- Exam by exam ------------------------------------------------- */}
      {exams.done.length > 0 ? (
        <section className="siq-card siq-rise overflow-hidden" style={{ animationDelay: '300ms' }}>
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <h2 className="text-[15px] font-semibold">Exam by exam</h2>
            <Link
              href={`/${slug}/my-assessments?tab=done`}
              className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
            >
              All assessments <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y border-t">
            {exams.done.map((e) => {
              const s = e.result ? standingById.get(e.result.id) : undefined
              const row = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{e.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {e.submittedAt ? fmtShort(e.submittedAt) : '—'}
                      {s ? ` · ahead of ${s.betterThan}% of ${s.cohort}` : ''}
                    </p>
                  </div>
                  {e.result?.status === 'GRADED' ? (
                    <div className="hidden w-40 sm:block">
                      <Bar percent={e.result.percentage} className="h-1.5" />
                    </div>
                  ) : null}
                  <StatusPill status={e.result?.status ?? null} percentage={e.result?.percentage} passed={e.result?.passed} />
                </>
              )
              return (
                <li key={e.id}>
                  {e.result ? (
                    <Link href={`/my-results/${e.result.id}`} className="hover:bg-muted/50 flex items-center gap-4 px-6 py-3.5 transition-colors">
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 px-6 py-3.5">{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function Metric({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b p-6 last:border-b-0 sm:odd:border-r lg:border-r lg:border-b-0 lg:last:border-r-0">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

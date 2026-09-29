import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, FileCheck2, ListChecks, ShieldAlert, Target, Users } from 'lucide-react'

import { CompletionFunnel } from '@/components/analytics/completion-funnel'
import { Panel } from '@/components/analytics/panel'
import { PassRateGauge } from '@/components/analytics/pass-rate-gauge'
import { QuestionDifficultyChart } from '@/components/analytics/question-difficulty-chart'
import { ScoreHistogram } from '@/components/analytics/score-histogram'
import { StatCard } from '@/components/analytics/stat-card'
import { PanelEmpty, Pill } from '@/components/dashboard/bits'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { hasPermission } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors'
import { getAssessmentAnalytics } from '@/services/analytics/assessment-analytics'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Assessment analytics — SelectIQ' }

const FLAG_LABEL: Record<string, string> = {
  NO_FACE: 'No face',
  MULTIPLE_FACES: 'Multiple faces',
  FACE_MISMATCH: 'Face mismatch',
  TAB_SWITCH: 'Tab switch',
  FOCUS_LOSS: 'Focus loss',
  FULLSCREEN_EXIT: 'Left fullscreen',
  WINDOW_BLUR: 'Window blurred',
  WEBCAM_DENIED: 'Webcam denied',
}

/**
 * Plan 019 — per-assessment deep dive: who finished, how they scored, how
 * long it took, which sections and questions carried the difficulty, and
 * which questions look broken (low or negative discrimination).
 */
export default async function AssessmentAnalyticsPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  const { org: slug, id } = await params
  const user = (await getCurrentUser())!
  if (!hasPermission(user, PERMISSIONS.VIEW_ORG_RESULTS)) notFound()

  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  let a
  try {
    a = await getAssessmentAnalytics(org.id, id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  const completionRate =
    a.funnel.invited > 0 ? Math.round((a.funnel.submitted / a.funnel.invited) * 100) : null
  const flagged = Object.entries(a.proctoring.byType).sort((x, y) => y[1] - x[1])
  const suspect = a.questions.filter((q) => q.discrimination !== null && q.discrimination < 0.1)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="siq-eyebrow mb-2">
            <Link href={`/${slug}/analytics`} className="hover:text-foreground">
              Analytics
            </Link>{' '}
            / Assessment
          </p>
          <div className="flex items-center gap-3">
            <h1 className="truncate text-[26px] leading-tight font-semibold tracking-tight">
              {a.assessment.title}
            </h1>
            <Pill tone={a.assessment.status === 'PUBLISHED' ? 'success' : 'muted'}>
              {a.assessment.status.toLowerCase()}
            </Pill>
          </div>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {a.assessment.durationMinutes} min ·{' '}
            {a.assessment.passingScore !== null
              ? `pass mark ${a.assessment.passingScore}`
              : 'no pass mark set'}{' '}
            · {a.questions.length} questions
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" render={<Link href={`/${slug}/assessments/${id}/build`} />}>
            Edit
          </Button>
          <Button render={<Link href={`/${slug}/assessments/${id}/results`} />}>
            View results
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Submitted"
          value={a.funnel.submitted}
          hint={
            completionRate === null
              ? 'Nobody invited yet'
              : `${completionRate}% of ${a.funnel.invited} invited`
          }
          icon={Users}
        />
        <StatCard
          label="Average score"
          value={a.scores.avgPercentage}
          suffix={a.scores.avgPercentage === null ? undefined : '%'}
          hint={
            a.scores.medianPercentage === null
              ? undefined
              : `Median ${a.scores.medianPercentage}% · σ ${a.scores.stdDev ?? '—'}`
          }
          icon={Target}
        />
        <StatCard
          label="Median time"
          value={a.time.medianMinutes}
          suffix={a.time.medianMinutes === null ? undefined : ' min'}
          hint={`Limit ${a.time.limitMinutes} min${a.time.avgMinutes !== null ? ` · avg ${a.time.avgMinutes}` : ''}`}
          icon={Clock}
        />
        <StatCard
          label="Awaiting grading"
          value={a.scores.pendingReview}
          hint={`${a.scores.graded} fully graded`}
          icon={FileCheck2}
          tone={a.scores.pendingReview > 0 ? 'attention' : 'default'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel
          eyebrow="Scores"
          title="Score distribution"
          action={
            a.scores.highest !== null ? (
              <span className="text-muted-foreground text-xs">
                Range {a.scores.lowest}% – {a.scores.highest}%
              </span>
            ) : null
          }
        >
          <ScoreHistogram buckets={a.scores.histogram} />
        </Panel>
        <Panel eyebrow="Outcome" title="Pass rate" bodyClassName="grid place-items-center">
          <PassRateGauge rate={a.scores.passRate} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Completion" title="Candidate funnel">
          <CompletionFunnel
            invited={a.funnel.invited}
            started={a.funnel.started}
            submitted={a.funnel.submitted}
            timedOut={a.funnel.timedOut}
            inProgress={a.funnel.inProgress}
          />
        </Panel>

        <Panel eyebrow="Sections" title="Performance by section">
          {a.sectionPerformance.length === 0 ? (
            <PanelEmpty icon={ListChecks} title="No sections" />
          ) : (
            <ul className="flex flex-col gap-4">
              {a.sectionPerformance.map((s) => (
                <li key={s.sectionId} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{s.title}</span>
                    <span className="siq-numeric shrink-0">
                      {s.avgPercentage === null ? '—' : `${s.avgPercentage}%`}
                      <span className="text-muted-foreground ml-2 text-xs">
                        {s.questions} q
                      </span>
                    </span>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${s.avgPercentage ?? 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        eyebrow="Question quality"
        title="Difficulty and discrimination"
        action={
          suspect.length > 0 ? (
            <Pill tone="warning">
              {suspect.length} question{suspect.length === 1 ? '' : 's'} to review
            </Pill>
          ) : null
        }
      >
        <QuestionDifficultyChart questions={a.questions} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel eyebrow="Hardest" title="Most-missed questions">
          {a.mostMissed.length === 0 ? (
            <PanelEmpty icon={ListChecks} title="No graded responses yet" />
          ) : (
            <ol className="flex flex-col gap-3">
              {a.mostMissed.map((q, i) => {
                const dist = a.optionDistributions[q.questionId]
                return (
                  <li key={q.questionId} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">
                        <span className="text-muted-foreground siq-numeric mr-2">{i + 1}.</span>
                        {q.title}
                      </p>
                      <Pill tone="danger">
                        {Math.round((q.difficulty ?? 0) * 100)}% correct
                      </Pill>
                    </div>
                    {dist && dist.responses > 0 ? (
                      <div className="flex flex-col gap-1 pl-5">
                        {dist.options.map((o) => {
                          const pct = Math.round((o.count / dist.responses) * 100)
                          return (
                            <div key={o.id} className="flex items-center gap-2 text-xs">
                              <span
                                className={
                                  o.isCorrect
                                    ? 'text-success w-40 truncate font-medium'
                                    : 'text-muted-foreground w-40 truncate'
                                }
                                title={o.text}
                              >
                                {o.isCorrect ? '✓ ' : ''}
                                {o.text}
                              </span>
                              <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pct}%`,
                                    background: o.isCorrect ? 'var(--success)' : '#93c5fd',
                                  }}
                                />
                              </div>
                              <span className="siq-numeric w-9 text-right">{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ol>
          )}
        </Panel>

        <Panel eyebrow="Integrity" title="Proctoring flags">
          {!a.proctoring.enabled ? (
            <PanelEmpty
              icon={ShieldAlert}
              title="Proctoring is off"
              body="Turn it on in the assessment settings to track face presence and tab switches."
            />
          ) : flagged.length === 0 ? (
            <PanelEmpty icon={ShieldAlert} title="No flags raised" />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {flagged.map(([type, count]) => (
                <li key={type} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 truncate">{FLAG_LABEL[type] ?? type}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${(count / flagged[0]![1]) * 100}%` }}
                    />
                  </div>
                  <span className="siq-numeric w-10 text-right">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}

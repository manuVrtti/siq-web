import type { Scope } from '@/lib/auth/scope'
import 'server-only'

import { buildWorkbook } from '@/lib/import/xlsx-parser'
import { getAssessmentAnalytics } from '@/services/analytics/assessment-analytics'

/**
 * Plan 020 — assessment analytics as a multi-sheet workbook, built from the
 * exact same numbers as the analytics page (getAssessmentAnalytics), so the
 * export can never disagree with the screen.
 */
export async function exportAssessmentAnalytics(scope: Scope, assessmentId: string) {
  const a = await getAssessmentAnalytics(scope, assessmentId)
  const dash = (v: number | null) => (v === null ? '' : v)

  const overview = [
    { Metric: 'Assessment', Value: a.assessment.title },
    { Metric: 'Invited', Value: a.funnel.invited },
    { Metric: 'Started', Value: a.funnel.started },
    { Metric: 'Submitted', Value: a.funnel.submitted },
    { Metric: 'Timed out', Value: a.funnel.timedOut },
    { Metric: 'Graded', Value: a.scores.graded },
    { Metric: 'Awaiting review', Value: a.scores.pendingReview },
    { Metric: 'Average %', Value: dash(a.scores.avgPercentage) },
    { Metric: 'Median %', Value: dash(a.scores.medianPercentage) },
    { Metric: 'Std deviation', Value: dash(a.scores.stdDev) },
    { Metric: 'Highest %', Value: dash(a.scores.highest) },
    { Metric: 'Lowest %', Value: dash(a.scores.lowest) },
    { Metric: 'Pass rate %', Value: a.scores.passRate === null ? 'No pass mark' : a.scores.passRate },
    { Metric: 'Median time (min)', Value: dash(a.time.medianMinutes) },
    { Metric: 'Average time (min)', Value: dash(a.time.avgMinutes) },
    { Metric: 'Time limit (min)', Value: a.time.limitMinutes },
  ]

  const distribution = a.scores.histogram.map((b) => ({ 'Score range %': b.label, Candidates: b.count }))

  const sectionTitle = new Map(a.sectionPerformance.map((s) => [s.sectionId, s.title]))
  const questions = a.questions.map((q, i) => ({
    '#': i + 1,
    Question: q.title,
    Type: q.type,
    Section: q.sectionId ? (sectionTitle.get(q.sectionId) ?? '') : '',
    Responses: q.responses,
    'Difficulty (% correct)': q.difficulty === null ? '' : Math.round(q.difficulty * 1000) / 10,
    Discrimination: dash(q.discrimination),
    'Avg marks': dash(q.avgScore),
    'Max marks': q.maxMarks,
  }))

  const sections = a.sectionPerformance.map((s) => ({
    Section: s.title,
    Questions: s.questions,
    'Average %': dash(s.avgPercentage),
  }))

  const proctoring = Object.entries(a.proctoring.byType).map(([type, count]) => ({ Flag: type, Count: count }))

  return {
    filename: `${a.assessment.title} - analytics.xlsx`,
    body: buildWorkbook([
      { name: 'Overview', rows: overview, widths: [22, 40] },
      { name: 'Score distribution', rows: distribution },
      { name: 'Questions', rows: questions, widths: [5, 48, 14, 20, 10, 20, 14, 10, 10] },
      { name: 'Sections', rows: sections },
      { name: 'Proctoring', rows: proctoring },
    ]),
  }
}

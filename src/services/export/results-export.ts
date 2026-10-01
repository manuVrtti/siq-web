import 'server-only'

import { NotFoundError } from '@/lib/errors'
import { buildWorkbook } from '@/lib/import/xlsx-parser'
import { batchWhere, studentWhere, userInScope, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'

/**
 * Plan 020 — results exports (Excel).
 *
 * One row per candidate with score, outcome, timing, a % column per section,
 * and proctoring flag counts. Cells are typed values, never formulas (see
 * buildWorkbook), so user-supplied names can't inject Excel formulas.
 * Callers must have authorised the org; every query here filters by it too.
 */

const TZ = 'Asia/Kolkata'
const ist = (d: Date | null | undefined) =>
  d
    ? new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: TZ,
      }).format(d)
    : ''
const r1 = (n: number | null | undefined) => (n === null || n === undefined ? null : Math.round(n * 10) / 10)

function outcome(status: string, passed: boolean | null): string {
  if (status === 'PENDING_REVIEW') return 'Awaiting review'
  if (passed === true) return 'Passed'
  if (passed === false) return 'Not passed'
  return 'Graded'
}

export async function exportAssessmentResults(scope: Scope, assessmentId: string) {
  const orgId = scope.orgId
  const assessment = await prisma.assessment.findFirst({
    where: { id: assessmentId, orgId },
    select: {
      id: true,
      title: true,
      durationMinutes: true,
      passingScore: true,
      sections: {
        orderBy: { order: 'asc' },
        select: { id: true, title: true, questions: { select: { questionId: true } } },
      },
    },
  })
  if (!assessment) throw new NotFoundError('Assessment not found')

  const results = await prisma.result.findMany({
    where: { assessmentId, ...userInScope(scope) },
    orderBy: [{ percentage: 'desc' }, { createdAt: 'asc' }],
    select: {
      status: true,
      totalScore: true,
      maxScore: true,
      percentage: true,
      passed: true,
      attemptId: true,
      user: { select: { name: true, email: true, phone: true } },
      attempt: { select: { startedAt: true, submittedAt: true } },
      questionResults: { select: { questionId: true, scoreAwarded: true, maxMarks: true } },
    },
  })

  const flags = await prisma.proctoringFlag.groupBy({
    by: ['sessionId', 'severity'],
    where: { session: { attemptId: { in: results.map((r) => r.attemptId) } } },
    _count: { _all: true },
  })
  const sessions = await prisma.proctoringSession.findMany({
    where: { attemptId: { in: results.map((r) => r.attemptId) } },
    select: { id: true, attemptId: true },
  })
  const attemptBySession = new Map(sessions.map((s) => [s.id, s.attemptId]))
  const flagTotals = new Map<string, { all: number; high: number }>()
  for (const f of flags) {
    const attemptId = attemptBySession.get(f.sessionId)
    if (!attemptId) continue
    const t = flagTotals.get(attemptId) ?? { all: 0, high: 0 }
    t.all += f._count._all
    if (f.severity === 'HIGH') t.high += f._count._all
    flagTotals.set(attemptId, t)
  }

  const sectionOf = new Map<string, string>()
  for (const s of assessment.sections) for (const q of s.questions) sectionOf.set(q.questionId, s.id)

  let rank = 0
  const rows = results.map((r) => {
    const graded = r.status === 'GRADED'
    if (graded) rank += 1
    const minutes =
      r.attempt?.submittedAt && r.attempt.startedAt
        ? r1((r.attempt.submittedAt.getTime() - r.attempt.startedAt.getTime()) / 60_000)
        : null
    const row: Record<string, string | number | null> = {
      Rank: graded ? rank : null,
      Name: r.user.name ?? '',
      Email: r.user.email ?? '',
      Phone: r.user.phone ?? '',
      Score: r1(r.totalScore),
      'Max score': r1(r.maxScore),
      'Percentage': graded ? r1(r.percentage) : null,
      Outcome: outcome(r.status, r.passed),
      'Time taken (min)': minutes,
      'Submitted (IST)': ist(r.attempt?.submittedAt),
    }
    for (const s of assessment.sections) {
      let got = 0
      let max = 0
      for (const qr of r.questionResults) {
        if (sectionOf.get(qr.questionId) !== s.id) continue
        got += qr.scoreAwarded
        max += qr.maxMarks
      }
      row[`${s.title} %`] = max > 0 ? r1((Math.max(0, got) / max) * 100) : null
    }
    const f = flagTotals.get(r.attemptId)
    row['Proctoring flags'] = f?.all ?? 0
    row['High-severity flags'] = f?.high ?? 0
    return row
  })

  const graded = results.filter((r) => r.status === 'GRADED')
  const decided = graded.filter((r) => r.passed !== null)
  const summary = [
    { Metric: 'Assessment', Value: assessment.title },
    { Metric: 'Exported (IST)', Value: ist(new Date()) },
    { Metric: 'Submissions', Value: results.length },
    { Metric: 'Graded', Value: graded.length },
    { Metric: 'Awaiting review', Value: results.length - graded.length },
    {
      Metric: 'Average %',
      Value: graded.length ? r1(graded.reduce((s, r) => s + r.percentage, 0) / graded.length) : '',
    },
    {
      Metric: 'Pass rate %',
      Value: decided.length ? r1((decided.filter((r) => r.passed).length / decided.length) * 100) : 'No pass mark',
    },
    { Metric: 'Pass mark', Value: assessment.passingScore ?? 'Not set' },
    { Metric: 'Duration (min)', Value: assessment.durationMinutes },
  ]

  return {
    filename: `${assessment.title} - results.xlsx`,
    body: buildWorkbook([
      { name: 'Results', rows },
      { name: 'Summary', rows: summary, widths: [18, 48] },
    ]),
  }
}

/** Every graded result of a batch's members across this org's assessments. */
export async function exportBatchResults(scope: Scope, batchId: string) {
  const orgId = scope.orgId
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, ...batchWhere(scope) },
    select: { name: true, members: { where: scope.all ? {} : { user: studentWhere(scope) }, select: { userId: true } } },
  })
  if (!batch) throw new NotFoundError('Batch not found')

  const results = await prisma.result.findMany({
    where: { userId: { in: batch.members.map((m) => m.userId) }, assessment: { orgId } },
    orderBy: [{ user: { name: 'asc' } }, { createdAt: 'asc' }],
    select: {
      status: true,
      totalScore: true,
      maxScore: true,
      percentage: true,
      passed: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
      assessment: { select: { title: true } },
    },
  })

  return {
    filename: `${batch.name} - batch results.xlsx`,
    body: buildWorkbook([
      {
        name: 'Batch results',
        rows: results.map((r) => ({
          Name: r.user.name ?? '',
          Email: r.user.email ?? '',
          Assessment: r.assessment.title,
          Score: r1(r.totalScore),
          'Max score': r1(r.maxScore),
          Percentage: r.status === 'GRADED' ? r1(r.percentage) : null,
          Outcome: outcome(r.status, r.passed),
          'Submitted (IST)': ist(r.createdAt),
        })),
      },
    ]),
  }
}

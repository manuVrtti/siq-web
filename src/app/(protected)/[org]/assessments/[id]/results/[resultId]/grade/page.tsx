import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import ManualGradingPanel from '@/components/results/manual-grading-panel'
import { ExamIntegrityPanel } from '@/components/proctoring/exam-integrity-panel'
import PageHeader from '@/components/ui/page-header'
import { PERMISSIONS } from '@/constants/permissions'
import { requireAssessmentPage } from '@/lib/auth/page-guard'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getAssessment } from '@/services/assessments'
import { getResultForAdmin } from '@/services/grading'
import { getSessionForAdmin } from '@/services/proctoring'

export const metadata: Metadata = { title: 'Grade Result — SelectIQ' }

/**
 * Plan 016 — admin's per-candidate grading page. Hydrates Question titles +
 * types and the candidate's original text answers so the evaluator has full
 * context, then delegates to the client panel.
 */
export default async function GradeResultPage({
  params,
}: {
  params: Promise<{ org: string; id: string; resultId: string }>
}) {
  const { org: slug, id, resultId } = await params
  const { org, scope } = await requireAssessmentPage(PERMISSIONS.VIEW_ORG_RESULTS, slug, id, 'view')

  const assessment = await getAssessment(org.id, id).catch(() => null)
  if (!assessment) notFound()

  let result
  try {
    result = await getResultForAdmin(scope, resultId)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  // Fetch the questions once and the candidate's answers (attempt-scoped).
  const questionIds = result.questionResults.map((q) => q.questionId)
  const [questions, answers] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, title: true, type: true },
    }),
    prisma.examAnswer.findMany({
      where: { attemptId: result.attemptId, questionId: { in: questionIds } },
      select: { questionId: true, textAnswer: true },
    }),
  ])
  const qById = new Map(questions.map((q) => [q.id, q]))
  const aById = new Map(answers.map((a) => [a.questionId, a]))

  // Plan 018 — attach the proctoring session for this attempt, if one exists.
  // `getSessionForAdmin` throws NotFound when there is no session, so we
  // resolve by id via a bare lookup first.
  const proctoringRow = await prisma.proctoringSession.findUnique({
    where: { attemptId: result.attemptId },
    select: { id: true },
  })
  const proctoring = proctoringRow
    ? await getSessionForAdmin(org.id, proctoringRow.id).catch(() => null)
    : null

  const enriched = result.questionResults.map((qr) => {
    const q = qById.get(qr.questionId)
    const a = aById.get(qr.questionId)
    return {
      id: qr.id,
      questionId: qr.questionId,
      scoreAwarded: qr.scoreAwarded,
      maxMarks: qr.maxMarks,
      isCorrect: qr.isCorrect,
      needsReview: qr.needsReview,
      feedback: qr.feedback,
      question: q
        ? { title: q.title, type: q.type, textAnswer: a?.textAnswer ?? null }
        : null,
    }
  })

  return (
    <>
      <PageHeader
        title={`Grade: ${assessment.title}`}
        description={`${org.name} · ${result.user.name ?? result.user.email ?? 'Candidate'}`}
      >
        <Link
          href={`/${slug}/assessments/${id}/results`}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← All results
        </Link>
        <a
          href={`/api/export/candidates/${result.user.id}/report?assessmentId=${id}`}
          download
          className="text-primary text-sm font-medium hover:underline"
        >
          Download PDF report
        </a>
      </PageHeader>

      {/* Plan 018b — staff-only exam integrity, first thing on the page. */}
      <div className="mb-6">
        <ExamIntegrityPanel session={proctoring} />
      </div>

      <ManualGradingPanel
        resultId={result.id}
        status={result.status}
        passed={result.passed}
        totalScore={result.totalScore}
        maxScore={result.maxScore}
        percentage={result.percentage}
        candidateName={result.user.name}
        candidateEmail={result.user.email}
        questionResults={enriched}
      />

    </>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ResultBreakdown } from '@/components/results/result-breakdown'
import { PassBadge, ResultStatusBadge, formatScore } from '@/components/results/score-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PageHeader from '@/components/ui/page-header'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { getResultForCandidate } from '@/services/grading'

export const metadata: Metadata = { title: 'Result — SelectIQ' }

/**
 * Plan 016 — a candidate's single result with per-question breakdown.
 *
 * A candidate can only see their OWN result. `getResultForCandidate` filters
 * by userId, so requesting somebody else's id yields NotFoundError → 404 (we
 * never confirm whether the id exists).
 */
export default async function MyResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = (await getCurrentUser())!

  let result
  try {
    result = await getResultForCandidate(user.id, id)
  } catch (error) {
    if (error instanceof NotFoundError) notFound()
    throw error
  }

  // QuestionResult has only questionId — hydrate the display fields.
  const questions = await prisma.question.findMany({
    where: { id: { in: result.questionResults.map((q) => q.questionId) } },
    select: { id: true, title: true, type: true },
  })
  const byId = new Map(questions.map((q) => [q.id, q]))

  const items = result.questionResults.map((qr) => ({
    id: qr.id,
    questionId: qr.questionId,
    scoreAwarded: qr.scoreAwarded,
    maxMarks: qr.maxMarks,
    isCorrect: qr.isCorrect,
    needsReview: qr.needsReview,
    feedback: qr.feedback,
    question: byId.get(qr.questionId) ?? null,
  }))

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <PageHeader title={result.assessment.title}>
        <Link
          href="/my-results"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← All results
        </Link>
      </PageHeader>

      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ResultStatusBadge status={result.status} />
            <PassBadge passed={result.passed} status={result.status} />
          </div>
          <CardTitle className="text-2xl font-semibold">
            {formatScore(result.totalScore)} / {formatScore(result.maxScore)}
            {result.status === 'GRADED' ? (
              <span className="text-muted-foreground ml-3 text-base font-normal">
                {result.percentage.toFixed(1)}%
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        {result.status !== 'GRADED' ? (
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Some questions still need manual review. Your final score and
              pass/fail decision will appear here once your evaluator finishes.
            </p>
          </CardContent>
        ) : null}
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Breakdown
        </h2>
        <ResultBreakdown items={items} />
      </div>
    </main>
  )
}

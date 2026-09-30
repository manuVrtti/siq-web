'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PassBadge, ResultStatusBadge, formatScore } from '@/components/results/score-badge'

/**
 * Plan 016 — evaluator's manual grading panel.
 *
 * Renders one editable row per QuestionResult that still `needsReview`.
 * Rows that are auto-graded are shown read-only above so the evaluator can see
 * what the candidate already got. Submits the whole batch of edits at once so
 * the Result is recomputed once, not per-question.
 */

type QR = {
  id: string
  questionId: string
  scoreAwarded: number
  maxMarks: number
  isCorrect: boolean | null
  needsReview: boolean
  feedback: string | null
  question: {
    title: string
    type: string
    textAnswer: string | null
  } | null
}

type Draft = { score: string; feedback: string }

export default function ManualGradingPanel({
  resultId,
  status,
  passed,
  totalScore,
  maxScore,
  percentage,
  candidateName,
  candidateEmail,
  questionResults,
}: {
  resultId: string
  status: 'PENDING_REVIEW' | 'GRADED'
  passed: boolean | null
  totalScore: number
  maxScore: number
  percentage: number
  candidateName: string | null
  candidateEmail: string | null
  questionResults: QR[]
}) {
  const router = useRouter()
  const pending = useMemo(() => questionResults.filter((q) => q.needsReview), [questionResults])
  const autoGraded = useMemo(
    () => questionResults.filter((q) => !q.needsReview),
    [questionResults],
  )

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      pending.map((q) => [
        q.id,
        { score: String(q.scoreAwarded ?? 0), feedback: q.feedback ?? '' },
      ]),
    ),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(id: string, patch: Partial<Draft>) {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }))
  }

  async function submit() {
    setError(null)
    const grades: { questionResultId: string; scoreAwarded: number; feedback: string | null }[] = []
    for (const q of pending) {
      const d = drafts[q.id]
      const num = Number.parseFloat(d.score)
      if (!Number.isFinite(num)) {
        setError(`Enter a numeric score for every question (invalid: ${q.question?.title ?? q.id})`)
        return
      }
      if (num < -q.maxMarks || num > q.maxMarks) {
        setError(`Score for "${q.question?.title ?? q.id}" must be between ${-q.maxMarks} and ${q.maxMarks}`)
        return
      }
      grades.push({
        questionResultId: q.id,
        scoreAwarded: num,
        feedback: d.feedback.trim() ? d.feedback.trim() : null,
      })
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/results/${resultId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || body?.success === false) {
        setError(body?.error?.message ?? 'Save failed')
        return
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <ResultStatusBadge status={status} />
            <PassBadge passed={passed} status={status} />
            <span className="text-muted-foreground ml-auto text-xs">
              {candidateEmail ?? ''}
            </span>
          </div>
          <CardTitle className="text-lg font-medium">
            {candidateName ?? 'Candidate'} — {formatScore(totalScore)} / {formatScore(maxScore)}
            {status === 'GRADED' ? (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                {percentage.toFixed(1)}%
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
      </Card>

      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Nothing awaits review — every question was auto-graded.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Awaiting review ({pending.length})
          </h2>
          {pending.map((q, i) => {
            const d = drafts[q.id]
            return (
              <Card key={q.id}>
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground text-xs">
                      #{i + 1}
                      {q.question?.type ? ` · ${q.question.type}` : ''}
                    </span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      Max {formatScore(q.maxMarks)}
                    </span>
                  </div>
                  <CardTitle className="text-base font-medium">
                    {q.question?.title ?? 'Question'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Candidate response
                    </p>
                    <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border p-3 text-sm font-mono">
                      {q.question?.textAnswer?.trim() || '(no response)'}
                    </pre>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <span>Score</span>
                      <Input
                        type="number"
                        className="w-24"
                        value={d.score}
                        min={-q.maxMarks}
                        max={q.maxMarks}
                        step="0.5"
                        onChange={(e) => update(q.id, { score: e.target.value })}
                      />
                      <span className="text-muted-foreground text-xs">/ {formatScore(q.maxMarks)}</span>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Feedback (optional)</span>
                    <textarea
                      value={d.feedback}
                      onChange={(e) => update(q.id, { feedback: e.target.value })}
                      className="border-input min-h-20 resize-y rounded-md border bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      placeholder="What the candidate did well or needs to improve"
                    />
                  </label>
                </CardContent>
              </Card>
            )
          })}

          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          <div className="flex items-center justify-end gap-2">
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Saving…' : `Save ${pending.length} grade${pending.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </div>
      )}

      {autoGraded.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Auto-graded ({autoGraded.length})
          </h2>
          {autoGraded.map((q, i) => (
            <Card key={q.id}>
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground text-xs">
                    #{i + 1}
                    {q.question?.type ? ` · ${q.question.type}` : ''}
                  </span>
                  <span
                    className={
                      q.isCorrect === true
                        ? 'text-xs text-success'
                        : q.isCorrect === false
                          ? 'text-xs text-destructive'
                          : 'text-muted-foreground text-xs'
                    }
                  >
                    {q.isCorrect === true ? 'correct' : q.isCorrect === false ? 'incorrect' : 'partial'}
                  </span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {formatScore(q.scoreAwarded)} / {formatScore(q.maxMarks)}
                  </span>
                </div>
                <CardTitle className="text-base font-medium">
                  {q.question?.title ?? 'Question'}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  )
}

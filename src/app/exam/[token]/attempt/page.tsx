import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import ExamRuntime from '@/components/exam/exam-runtime'
import ProctoringMonitor from '@/components/exam/proctoring-monitor'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getAttemptState } from '@/services/exam-session'

export const metadata: Metadata = {
  title: 'Taking exam — SelectIQ',
  robots: { index: false, follow: false },
}

/**
 * Plan 015 — the exam runtime.
 *
 * Server-loads the attempt state (questions, saved answers, deadline) and
 * hands it to the client. From then on the client autosaves as the candidate
 * works and re-loads state on refresh.
 */
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const user = await getCurrentUser()
  if (!user) redirect(`/login`)
  if (user.mustChangePassword) redirect('/set-password')

  const state = await getAttemptState(token, user.id).catch(() => null)
  if (!state) redirect(`/exam/${token}`)

  // Not started yet → send back to entry page to begin.
  if (!state.attempt) redirect(`/exam/${token}`)

  // Already submitted → back to entry page which shows the submitted state.
  if (state.attempt.submittedAt) redirect(`/exam/${token}`)

  // Prepare a plain-JSON payload for the client component.
  const sections = state.assignment.assessment.sections.map((s) => ({
    id: s.id,
    title: s.title,
    order: s.order,
    questions: s.questions.map((sq) => ({
      id: sq.question.id,
      type: sq.question.type,
      title: sq.question.title,
      body: sq.question.body,
      marks: sq.marksOverride ?? sq.question.marks,
      options: sq.question.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  }))

  const a = state.assignment.assessment

  return (
    <>
      <ExamRuntime
        token={token}
        title={a.title}
        sections={sections}
        questionOrder={state.attempt.questionOrder}
        answers={state.attempt.answers}
        deadlineAtIso={state.attempt.deadlineAt.toISOString()}
        serverNowIso={state.now.toISOString()}
      />
      {a.proctoringEnabled ? (
        <ProctoringMonitor
          token={token}
          intervalSec={a.snapshotIntervalSec}
          storeSnapshots={a.storeSnapshots}
          faceMatchThreshold={a.faceMatchThreshold}
        />
      ) : null}
    </>
  )
}

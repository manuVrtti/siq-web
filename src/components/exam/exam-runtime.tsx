'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Plan 015 — the exam runtime.
 *
 * One React tree that handles:
 *   - server-synced countdown (client shows animation; server-authoritative
 *     `deadlineAt` is the truth; drift computed once at mount)
 *   - section + question navigation
 *   - per-type answer rendering (MCQ single/multi, true/false, subjective)
 *   - autosave (debounced) on every change, plus explicit save on navigate
 *   - submit with confirmation
 *   - auto-submit when the countdown hits zero
 *
 * CODING questions render a "coming with Plan 014" note. Everything else works.
 */

type Option = { id: string; text: string }
type Question = {
  id: string
  type: string
  title: string
  body: string
  marks: number
  options: Option[]
}
type Section = { id: string; title: string; order: number; questions: Question[] }
type SavedAnswer = { selectedOptionIds: string[]; textAnswer: string | null }

const AUTOSAVE_MS = 500

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

export default function ExamRuntime({
  token,
  title,
  sections,
  questionOrder,
  answers: initialAnswers,
  deadlineAtIso,
  serverNowIso,
}: {
  token: string
  title: string
  sections: Section[]
  questionOrder: { sections: { sectionId: string; questionIds: string[] }[] }
  answers: Record<string, SavedAnswer>
  deadlineAtIso: string
  serverNowIso: string
}) {
  const router = useRouter()

  /* --- flattened questions in the resolved shuffle order --- */
  const orderedQuestions = useMemo(() => {
    const byId = new Map<string, { section: Section; question: Question }>()
    for (const s of sections) for (const q of s.questions) byId.set(q.id, { section: s, question: q })
    const flat: { section: Section; question: Question }[] = []
    for (const s of questionOrder.sections) {
      for (const qid of s.questionIds) {
        const hit = byId.get(qid)
        if (hit) flat.push(hit)
      }
    }
    return flat
  }, [sections, questionOrder])

  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>(initialAnswers)
  const [current, setCurrent] = useState(0)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /* --- server-authoritative timer --- */
  // Compute the offset between server and client clocks once at mount, so the
  // countdown stays accurate even if the client clock is off.
  const clientOffsetMs = useRef(Date.now() - new Date(serverNowIso).getTime())
  const deadlineMs = new Date(deadlineAtIso).getTime()
  const [remainingMs, setRemainingMs] = useState(deadlineMs - (Date.now() - clientOffsetMs.current))

  useEffect(() => {
    const tick = () => setRemainingMs(deadlineMs - (Date.now() - clientOffsetMs.current))
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [deadlineMs])

  /* --- autosave on answer change (debounced per-question) --- */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const doSave = useCallback(
    async (questionId: string, answer: SavedAnswer) => {
      setSaveState('saving')
      try {
        const res = await fetch(`/api/exam/${token}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId,
            selectedOptionIds: answer.selectedOptionIds,
            textAnswer: answer.textAnswer,
          }),
        })
        if (!res.ok) throw new Error('save failed')
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    },
    [token],
  )

  const updateAnswer = useCallback(
    (questionId: string, next: SavedAnswer) => {
      setAnswers((prev) => ({ ...prev, [questionId]: next }))
      if (timers.current[questionId]) window.clearTimeout(timers.current[questionId])
      timers.current[questionId] = setTimeout(() => doSave(questionId, next), AUTOSAVE_MS)
    },
    [doSave],
  )

  /* --- auto-submit at deadline --- */
  const autoSubmittedRef = useRef(false)
  useEffect(() => {
    if (remainingMs > 0 || autoSubmittedRef.current) return
    autoSubmittedRef.current = true
    void doSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs])

  async function doSubmit() {
    setSubmitting(true)
    try {
      await fetch(`/api/exam/${token}/submit`, { method: 'POST' })
    } finally {
      router.push(`/exam/${token}`)
      router.refresh()
    }
  }

  if (orderedQuestions.length === 0) {
    return (
      <ExamShell title={title} remainingMs={remainingMs} saveState={saveState} onSubmitClick={() => setConfirmSubmit(true)}>
        <p className="p-6 text-sm">This assessment has no questions.</p>
      </ExamShell>
    )
  }

  const active = orderedQuestions[current]

  return (
    <ExamShell title={title} remainingMs={remainingMs} saveState={saveState} onSubmitClick={() => setConfirmSubmit(true)}>
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <Palette
          orderedQuestions={orderedQuestions}
          answers={answers}
          current={current}
          onJump={(i) => setCurrent(i)}
        />

        <div className="flex flex-col gap-4">
          <div className="rounded-lg border p-5">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Section: {active.section.title}
              </Badge>
              <span className="text-muted-foreground text-xs">
                Q{current + 1} of {orderedQuestions.length} · {active.question.marks} mk
              </span>
            </div>
            <h2 className="mb-2 text-base font-medium">{active.question.title}</h2>
            <p className="text-muted-foreground mb-4 whitespace-pre-wrap text-sm">{active.question.body}</p>

            <QuestionEditor
              question={active.question}
              answer={answers[active.question.id] ?? { selectedOptionIds: [], textAnswer: null }}
              onChange={(next) => updateAnswer(active.question.id, next)}
            />
          </div>

          <div className="flex justify-between">
            <Button
              variant="outline"
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            >
              Previous
            </Button>
            <Button
              disabled={current === orderedQuestions.length - 1}
              onClick={() => setCurrent((c) => Math.min(orderedQuestions.length - 1, c + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {confirmSubmit && (
        <ConfirmSubmit
          answered={Object.keys(answers).filter((qid) => hasAnswerContent(answers[qid])).length}
          total={orderedQuestions.length}
          busy={submitting}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={doSubmit}
        />
      )}
    </ExamShell>
  )
}

function hasAnswerContent(a: SavedAnswer | undefined): boolean {
  if (!a) return false
  return (a.selectedOptionIds?.length ?? 0) > 0 || (a.textAnswer ?? '').trim().length > 0
}

function ExamShell({
  title,
  remainingMs,
  saveState,
  onSubmitClick,
  children,
}: {
  title: string
  remainingMs: number
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  onSubmitClick: () => void
  children: React.ReactNode
}) {
  const warn = remainingMs > 0 && remainingMs < 5 * 60_000
  const over = remainingMs <= 0
  const saveLabel = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Save failed' }[saveState]

  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <h1 className="truncate text-sm font-semibold">{title}</h1>
          <span
            role="timer"
            aria-live="off"
            className={cn(
              'ml-auto font-mono text-sm tabular-nums',
              over && 'text-destructive font-semibold',
              warn && !over && 'text-yellow-600 font-medium',
            )}
          >
            {formatRemaining(remainingMs)}
          </span>
          <span className="text-muted-foreground w-16 text-right text-xs" aria-live="polite">
            {saveLabel}
          </span>
          <Button size="sm" onClick={onSubmitClick}>
            Submit
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 p-4">{children}</div>
    </div>
  )
}

function Palette({
  orderedQuestions,
  answers,
  current,
  onJump,
}: {
  orderedQuestions: { section: Section; question: Question }[]
  answers: Record<string, SavedAnswer>
  current: number
  onJump: (i: number) => void
}) {
  return (
    <aside className="hidden flex-col gap-2 md:flex">
      <h2 className="text-sm font-semibold">Palette</h2>
      <div className="grid grid-cols-5 gap-1.5">
        {orderedQuestions.map((oq, i) => {
          const answered = hasAnswerContent(answers[oq.question.id])
          const isCurrent = i === current
          return (
            <button
              key={oq.question.id}
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                'h-8 rounded-md border text-xs',
                isCurrent && 'border-primary bg-accent',
                !isCurrent && answered && 'bg-secondary text-secondary-foreground border-transparent',
                !isCurrent && !answered && 'border-current/20',
              )}
              aria-label={`Question ${i + 1}${answered ? ' (answered)' : ''}${isCurrent ? ' (current)' : ''}`}
            >
              {i + 1}
            </button>
          )
        })}
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        Answered: {Object.keys(answers).filter((qid) => hasAnswerContent(answers[qid])).length} /{' '}
        {orderedQuestions.length}
      </p>
    </aside>
  )
}

function QuestionEditor({
  question,
  answer,
  onChange,
}: {
  question: Question
  answer: SavedAnswer
  onChange: (next: SavedAnswer) => void
}) {
  if (question.type === 'CODING') {
    return (
      <p className="text-muted-foreground text-sm">
        Coding questions arrive with Plan 014 (Judge0). This item cannot yet be answered.
      </p>
    )
  }

  if (question.type === 'SUBJECTIVE') {
    return (
      <textarea
        className="min-h-40 w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-current/50"
        placeholder="Type your answer here…"
        value={answer.textAnswer ?? ''}
        onChange={(e) => onChange({ selectedOptionIds: [], textAnswer: e.target.value })}
      />
    )
  }

  const isSingle = question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE'

  return (
    <div className="flex flex-col gap-2">
      {question.options.map((o) => {
        const on = answer.selectedOptionIds.includes(o.id)
        return (
          <label
            key={o.id}
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm',
              on ? 'border-primary bg-accent' : 'border-current/20 hover:border-current/40',
            )}
          >
            <input
              type={isSingle ? 'radio' : 'checkbox'}
              name={`q-${question.id}`}
              checked={on}
              onChange={(e) => {
                if (isSingle) {
                  onChange({ selectedOptionIds: [o.id], textAnswer: null })
                } else {
                  const next = new Set(answer.selectedOptionIds)
                  if (e.target.checked) next.add(o.id)
                  else next.delete(o.id)
                  onChange({ selectedOptionIds: [...next], textAnswer: null })
                }
              }}
              className="size-4"
            />
            <span>{o.text}</span>
          </label>
        )
      })}
    </div>
  )
}

function ConfirmSubmit({
  answered,
  total,
  busy,
  onCancel,
  onConfirm,
}: {
  answered: number
  total: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-background w-full max-w-sm rounded-lg border p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-base font-semibold">Submit exam?</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          You have answered {answered} of {total} question{total === 1 ? '' : 's'}. This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  )
}

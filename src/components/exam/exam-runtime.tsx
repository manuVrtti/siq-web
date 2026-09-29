'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Clock, CloudOff, Loader2 } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Plan 015 — the exam runtime. Redesigned in plan 019 Phase 3.
 *
 * One React tree that handles:
 *   - server-synced countdown (client shows animation; server-authoritative
 *     `deadlineAt` is the truth; drift computed once at mount)
 *   - section + question navigation
 *   - per-type answer rendering (MCQ single/multi, true/false, subjective)
 *   - autosave (debounced) on every change
 *   - submit with confirmation, and auto-submit when the countdown hits zero
 *
 * Both submit paths FLUSH pending autosaves first. Without that, an answer
 * changed less than AUTOSAVE_MS before submitting (or before the timer ran
 * out) was never sent, and the candidate lost it.
 *
 * CODING questions render a "coming with Plan 014" note.
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
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const AUTOSAVE_MS = 500
const WARN_MS = 5 * 60_000
const OPTION_LETTERS = 'ABCDEFGHIJ'

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hh > 0 ? `${pad(hh)}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

function hasAnswerContent(a: SavedAnswer | undefined): boolean {
  if (!a) return false
  return (a.selectedOptionIds?.length ?? 0) > 0 || (a.textAnswer ?? '').trim().length > 0
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
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [confirmSubmit, setConfirmSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  /* --- server-authoritative timer --- */
  // Compute the offset between server and client clocks once at mount, so the
  // countdown stays accurate even if the client clock is off.
  // Lazy initializers: run exactly once at mount (same semantics as before),
  // and keep impure Date.now() out of the render body.
  const [clientOffsetMs] = useState(() => Date.now() - new Date(serverNowIso).getTime())
  const deadlineMs = new Date(deadlineAtIso).getTime()
  const [remainingMs, setRemainingMs] = useState(() => deadlineMs - (Date.now() - clientOffsetMs))

  useEffect(() => {
    const tick = () => setRemainingMs(deadlineMs - (Date.now() - clientOffsetMs))
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [deadlineMs, clientOffsetMs])

  /* --- autosave on answer change (debounced per-question) --- */
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  // Answers changed but not yet sent. Flushed before any submit.
  const unsent = useRef<Record<string, SavedAnswer>>({})

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
        // Only clear if nothing newer was queued for this question meanwhile.
        if (unsent.current[questionId] === answer) delete unsent.current[questionId]
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
      unsent.current[questionId] = next
      if (timers.current[questionId]) window.clearTimeout(timers.current[questionId])
      timers.current[questionId] = setTimeout(() => doSave(questionId, next), AUTOSAVE_MS)
    },
    [doSave],
  )

  /** Send every answer still waiting on its debounce, and wait for them. */
  const flushPendingSaves = useCallback(async () => {
    for (const t of Object.values(timers.current)) window.clearTimeout(t)
    timers.current = {}
    const pending = Object.entries(unsent.current)
    await Promise.all(pending.map(([qid, a]) => doSave(qid, a)))
  }, [doSave])

  /* --- submit (manual + auto at deadline) --- */
  const submittingRef = useRef(false)
  const doSubmit = useCallback(async () => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    try {
      await flushPendingSaves()
      await fetch(`/api/exam/${token}/submit`, { method: 'POST' })
    } finally {
      router.push(`/exam/${token}`)
      router.refresh()
    }
  }, [flushPendingSaves, router, token])

  useEffect(() => {
    if (remainingMs > 0) return
    void doSubmit()
  }, [remainingMs, doSubmit])

  const answeredCount = orderedQuestions.filter((oq) => hasAnswerContent(answers[oq.question.id])).length

  if (orderedQuestions.length === 0) {
    return (
      <ExamShell
        title={title}
        remainingMs={remainingMs}
        saveState={saveState}
        answered={0}
        total={0}
        onSubmitClick={() => setConfirmSubmit(true)}
      >
        <p className="siq-card p-6 text-sm">This assessment has no questions.</p>
      </ExamShell>
    )
  }

  const active = orderedQuestions[current]!
  const isLast = current === orderedQuestions.length - 1

  return (
    <ExamShell
      title={title}
      remainingMs={remainingMs}
      saveState={saveState}
      answered={answeredCount}
      total={orderedQuestions.length}
      onSubmitClick={() => setConfirmSubmit(true)}
    >
      <div className="grid gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
        <Palette
          orderedQuestions={orderedQuestions}
          answers={answers}
          current={current}
          onJump={setCurrent}
        />

        <div className="flex min-w-0 flex-col gap-4">
          <article className="siq-card p-6 sm:p-8">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <p className="siq-eyebrow">
                {active.section.title} · Question {current + 1} of {orderedQuestions.length}
              </p>
              <span className="bg-accent text-accent-foreground siq-numeric ml-auto rounded-md px-2 py-0.5 text-xs font-medium">
                {active.question.marks} mark{active.question.marks === 1 ? '' : 's'}
              </span>
            </div>
            <h2 className="text-lg leading-snug font-semibold">{active.question.title}</h2>
            {active.question.body ? (
              <p className="text-foreground/80 mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">
                {active.question.body}
              </p>
            ) : null}

            <div className="mt-6">
              <QuestionEditor
                question={active.question}
                answer={answers[active.question.id] ?? { selectedOptionIds: [], textAnswer: null }}
                onChange={(next) => updateAnswer(active.question.id, next)}
              />
            </div>
          </article>

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              size="lg"
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>
            {isLast ? (
              <Button size="lg" onClick={() => setConfirmSubmit(true)}>
                Review &amp; submit
              </Button>
            ) : (
              <Button size="lg" onClick={() => setCurrent((c) => Math.min(orderedQuestions.length - 1, c + 1))}>
                Next
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>

      {confirmSubmit && (
        <ConfirmSubmit
          answered={answeredCount}
          total={orderedQuestions.length}
          busy={submitting}
          onCancel={() => setConfirmSubmit(false)}
          onConfirm={doSubmit}
        />
      )}
    </ExamShell>
  )
}

function ExamShell({
  title,
  remainingMs,
  saveState,
  answered,
  total,
  onSubmitClick,
  children,
}: {
  title: string
  remainingMs: number
  saveState: SaveState
  answered: number
  total: number
  onSubmitClick: () => void
  children: React.ReactNode
}) {
  const over = remainingMs <= 0
  const warn = !over && remainingMs < WARN_MS
  const progress = total > 0 ? (answered / total) * 100 : 0

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <header className="siq-header h-auto flex-col items-stretch gap-0 px-0 md:px-0">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 md:px-6">
          <BrandMark className="size-7 shrink-0" />
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h1>

          <SaveIndicator state={saveState} />

          <span
            role="timer"
            aria-live="off"
            aria-label={`Time remaining ${formatRemaining(remainingMs)}`}
            className={cn(
              'siq-numeric inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors',
              !warn && !over && 'bg-card',
              warn && 'border-warning/40 bg-warning/10 text-warning',
              over && 'border-destructive/40 bg-destructive/10 text-destructive',
            )}
          >
            <Clock className="size-4" aria-hidden />
            {formatRemaining(remainingMs)}
          </span>

          <Button onClick={onSubmitClick}>Submit</Button>
        </div>
        {/* Answered progress — a thin blue rule under the header. */}
        <div className="bg-muted h-0.5 w-full" aria-hidden>
          <div className="bg-primary h-full transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {warn ? (
        <div className="bg-warning/10 text-warning border-warning/20 border-b px-4 py-2 text-center text-xs font-medium">
          Less than 5 minutes left. Your exam submits automatically when the timer reaches zero.
        </div>
      ) : null}

      {/* pb-40 leaves room for the fixed proctoring webcam preview (bottom-right). */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-40 md:px-6">{children}</main>
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return <span className="hidden w-20 sm:block" />
  const cfg = {
    saving: { Icon: Loader2, text: 'Saving', cls: 'text-muted-foreground', spin: true },
    saved: { Icon: Check, text: 'Saved', cls: 'text-success', spin: false },
    error: { Icon: CloudOff, text: 'Not saved', cls: 'text-destructive', spin: false },
  }[state]
  return (
    <span
      className={cn('hidden w-20 items-center justify-end gap-1 text-xs font-medium sm:inline-flex', cfg.cls)}
      aria-live="polite"
    >
      <cfg.Icon className={cn('size-3.5', cfg.spin && 'animate-spin')} aria-hidden />
      {cfg.text}
    </span>
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
  // Group by section, keeping each question's global index for navigation.
  const groups: { section: Section; items: { index: number; id: string }[] }[] = []
  orderedQuestions.forEach((oq, index) => {
    const last = groups[groups.length - 1]
    if (last && last.section.id === oq.section.id) last.items.push({ index, id: oq.question.id })
    else groups.push({ section: oq.section, items: [{ index, id: oq.question.id }] })
  })
  const answered = orderedQuestions.filter((oq) => hasAnswerContent(answers[oq.question.id])).length

  return (
    <aside className="siq-card hidden h-fit flex-col gap-4 p-4 md:sticky md:top-24 md:flex">
      <div>
        <p className="siq-eyebrow">Questions</p>
        <p className="mt-1 text-sm">
          <span className="siq-numeric font-semibold">{answered}</span>
          <span className="text-muted-foreground"> of {orderedQuestions.length} answered</span>
        </p>
      </div>

      {groups.map((g) => (
        <div key={g.section.id} className="flex flex-col gap-2">
          {groups.length > 1 ? (
            <p className="text-muted-foreground truncate text-xs font-medium">{g.section.title}</p>
          ) : null}
          <div className="grid grid-cols-5 gap-1.5">
            {g.items.map(({ index, id }) => {
              const isAnswered = hasAnswerContent(answers[id])
              const isCurrent = index === current
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onJump(index)}
                  className={cn(
                    'siq-numeric siq-focus h-9 rounded-lg border text-xs font-medium transition-colors',
                    isCurrent && 'border-primary ring-primary/30 ring-2',
                    isAnswered
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card hover:bg-muted',
                  )}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Question ${index + 1}${isAnswered ? ', answered' : ', not answered'}`}
                >
                  {index + 1}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t pt-3 text-[11px]">
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-primary size-2.5 rounded-sm" /> Answered
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="bg-card size-2.5 rounded-sm border" /> Not answered
        </span>
      </div>
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
      <p className="bg-muted text-muted-foreground rounded-xl p-4 text-sm">
        Coding questions can&apos;t be answered in this exam yet. Move on to the next question, and
        tell your placement cell if you think this is a mistake.
      </p>
    )
  }

  if (question.type === 'SUBJECTIVE') {
    const text = answer.textAnswer ?? ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    return (
      <div className="flex flex-col gap-1.5">
        <textarea
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 min-h-56 w-full resize-y rounded-xl border px-4 py-3 text-[15px] leading-relaxed outline-none focus-visible:ring-3"
          placeholder="Type your answer here…"
          value={text}
          onChange={(e) => onChange({ selectedOptionIds: [], textAnswer: e.target.value })}
          aria-label="Your answer"
        />
        <p className="text-muted-foreground siq-numeric text-right text-xs">
          {words} word{words === 1 ? '' : 's'}
        </p>
      </div>
    )
  }

  const isSingle = question.type === 'MCQ_SINGLE' || question.type === 'TRUE_FALSE'

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="text-muted-foreground mb-2 text-xs">
        {isSingle ? 'Choose one answer' : 'Select all that apply'}
      </legend>
      {question.options.map((o, i) => {
        const on = answer.selectedOptionIds.includes(o.id)
        return (
          <label
            key={o.id}
            className={cn(
              'group flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 text-[15px] transition-colors',
              'has-[:focus-visible]:ring-ring/40 has-[:focus-visible]:ring-3',
              on ? 'border-primary bg-primary/5' : 'bg-card hover:border-primary/40 hover:bg-muted/40',
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
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'siq-numeric grid size-7 shrink-0 place-items-center text-xs font-semibold transition-colors',
                isSingle ? 'rounded-full' : 'rounded-md',
                on ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {on && !isSingle ? <Check className="size-3.5" /> : OPTION_LETTERS[i] ?? i + 1}
            </span>
            <span className="leading-snug">{o.text}</span>
          </label>
        )
      })}
    </fieldset>
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
  const unanswered = total - answered
  return (
    <div
      role="dialog"
      aria-modal
      aria-labelledby="submit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={busy ? undefined : onCancel}
    >
      <div
        className="bg-popover w-full max-w-md rounded-2xl border p-6 shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="submit-title" className="text-lg font-semibold">
          Submit your exam?
        </h2>
        <p className="text-muted-foreground mt-1.5 text-sm">
          You&apos;ve answered <span className="text-foreground siq-numeric font-medium">{answered}</span> of{' '}
          <span className="siq-numeric">{total}</span> question{total === 1 ? '' : 's'}. You can&apos;t
          change answers after submitting.
        </p>

        {unanswered > 0 ? (
          <div className="bg-warning/10 text-warning mt-4 flex items-start gap-2 rounded-xl p-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {unanswered} question{unanswered === 1 ? ' is' : 's are'} still unanswered.
            </span>
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Keep working
          </Button>
          <Button onClick={onConfirm} disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden /> Submitting…
              </>
            ) : (
              'Submit exam'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

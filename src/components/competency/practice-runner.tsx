'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ChevronLeft, ChevronRight, Lightbulb, RotateCcw, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Plan 027 — self-check practice for one skill. Nothing is graded or saved:
 * the student answers, checks, and sees the right answer + explanation.
 * Only questions staff opened for practice ever reach this component.
 */

type Q = {
  id: string
  type: string
  title: string
  body: string
  difficulty: string
  explanation: string | null
  options: { id: string; text: string; isCorrect: boolean }[]
}

export function PracticeRunner({ skillName, questions, backHref }: { skillName: string; questions: Q[]; backHref: string }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  const q = questions[i]!
  const multi = q.type === 'MCQ_MULTI'
  const objective = q.options.length > 0
  const sel = picked[q.id] ?? []
  const isChecked = checked[q.id] ?? false
  const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id)
  const right = isChecked && objective && sel.length === correctIds.length && sel.every((x) => correctIds.includes(x))
  const done = Object.keys(checked).length
  const score = questions.filter((qq) => {
    if (!checked[qq.id] || qq.options.length === 0) return false
    const c = qq.options.filter((o) => o.isCorrect).map((o) => o.id)
    const s = picked[qq.id] ?? []
    return s.length === c.length && s.every((x) => c.includes(x))
  }).length

  function toggle(id: string) {
    if (isChecked) return
    setPicked((p) => ({ ...p, [q.id]: multi ? (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]) : [id] }))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Question <b className="text-foreground">{i + 1}</b> of {questions.length} · {skillName}
        </p>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Checked {done} · <b className="text-success">{score} right</b>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPicked({})
              setChecked({})
              setI(0)
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden /> Restart
          </Button>
        </div>
      </div>
      <div className="bg-muted h-1.5 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full transition-all duration-300" style={{ width: `${((i + 1) / questions.length) * 100}%` }} />
      </div>

      <section key={q.id} className="siq-card siq-rise flex flex-col gap-4 p-5 md:p-6">
        <div>
          <p className="text-muted-foreground mb-1 text-[11px] font-medium tracking-wider uppercase">{q.difficulty.toLowerCase()}</p>
          <h2 className="text-[17px] font-semibold">{q.title}</h2>
          <p className="mt-2 text-sm whitespace-pre-wrap">{q.body}</p>
        </div>

        {objective ? (
          <ul className="flex flex-col gap-2" role={multi ? 'group' : 'radiogroup'}>
            {q.options.map((o) => {
              const on = sel.includes(o.id)
              const state = isChecked ? (o.isCorrect ? 'right' : on ? 'wrong' : 'idle') : on ? 'on' : 'idle'
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    role={multi ? 'checkbox' : 'radio'}
                    aria-checked={on}
                    onClick={() => toggle(o.id)}
                    disabled={isChecked}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all',
                      state === 'on' && 'border-primary bg-primary/5',
                      state === 'right' && 'border-success bg-success/10',
                      state === 'wrong' && 'border-destructive bg-destructive/10',
                      state === 'idle' && 'border-current/15 hover:border-current/35',
                    )}
                  >
                    {state === 'right' ? (
                      <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
                    ) : state === 'wrong' ? (
                      <XCircle className="text-destructive size-4 shrink-0" aria-hidden />
                    ) : (
                      <span className={cn('size-4 shrink-0 border', multi ? 'rounded' : 'rounded-full', on ? 'border-primary bg-primary' : 'border-current/30')} />
                    )}
                    {o.text}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground rounded-xl border border-dashed px-4 py-3 text-sm">
            Write your answer on paper or in your head, then reveal the model answer.
          </p>
        )}

        {isChecked ? (
          <div className={cn('siq-rise rounded-xl p-4 text-sm', objective ? (right ? 'bg-success/10' : 'bg-warning/10') : 'bg-muted')}>
            {objective ? <p className={cn('mb-1 font-semibold', right ? 'text-success' : 'text-warning')}>{right ? 'Correct!' : 'Not quite.'}</p> : null}
            {q.explanation ? (
              <p className="flex gap-2">
                <Lightbulb className="text-highlight mt-0.5 size-4 shrink-0" aria-hidden />
                <span className="whitespace-pre-wrap">{q.explanation}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">No explanation was added for this question.</p>
            )}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}>
            <ChevronLeft className="size-4" aria-hidden /> Previous
          </Button>
          {!isChecked ? (
            <Button size="sm" disabled={objective && sel.length === 0} onClick={() => setChecked((c) => ({ ...c, [q.id]: true }))}>
              {objective ? 'Check answer' : 'Show model answer'}
            </Button>
          ) : i < questions.length - 1 ? (
            <Button size="sm" onClick={() => setI(i + 1)}>
              Next <ChevronRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button size="sm" render={<Link href={backHref} />}>
              Done — back to focus areas
            </Button>
          )}
        </div>
      </section>
      <p className="text-muted-foreground text-xs">Practice isn’t graded and doesn’t change your scores. Your next test will.</p>
    </div>
  )
}

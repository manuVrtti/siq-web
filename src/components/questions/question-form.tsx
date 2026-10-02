'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import TopicSkillPicker, { type TaxonomyTopic } from '@/components/questions/topic-skill-picker'
import { cn } from '@/lib/utils'
import { useActiveOrg } from '@/lib/org-context'
import { DIFFICULTIES, QUESTION_TYPES } from '@/lib/validators/question'

/**
 * Plan 011 — create / edit a question.
 *
 * The visible fields follow the type: choice types (MCQ, multi-select,
 * true/false) show an option editor; subjective and coding do not. Client-side
 * checks mirror the server's `questionInputSchema`, but the server is the gate.
 */

type Option = { text: string; isCorrect: boolean }
type TagOption = { id: string; name: string }

export type QuestionFormData = {
  id?: string
  type: string
  title: string
  body: string
  difficulty: string
  marks: number
  negativeMarks: number
  explanation: string
  options: Option[]
  tagIds: string[]
  topicId: string
  skillIds: string[]
  practiceEnabled?: boolean
}

const TYPE_LABEL: Record<string, string> = {
  MCQ_SINGLE: 'Single-answer MCQ',
  MCQ_MULTI: 'Multi-select MCQ',
  TRUE_FALSE: 'True / False',
  SUBJECTIVE: 'Subjective',
  CODING: 'Coding',
}

const fieldClass =
  'w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-current/50'

function hasOptions(type: string) {
  return type === 'MCQ_SINGLE' || type === 'MCQ_MULTI' || type === 'TRUE_FALSE'
}

export default function QuestionForm({
  orgId,
  orgTags,
  topics,
  initial,
}: {
  orgId: string
  orgTags: TagOption[]
  topics: TaxonomyTopic[]
  initial?: QuestionFormData
}) {
  const router = useRouter()
  const activeOrg = useActiveOrg()
  const [tags, setTags] = useState<TagOption[]>(orgTags)

  const [type, setType] = useState(initial?.type ?? 'MCQ_SINGLE')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [body, setBody] = useState(initial?.body ?? '')
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? 'MEDIUM')
  const [marks, setMarks] = useState(initial?.marks ?? 1)
  const [negativeMarks, setNegativeMarks] = useState(initial?.negativeMarks ?? 0)
  const [explanation, setExplanation] = useState(initial?.explanation ?? '')
  const [tagIds, setTagIds] = useState<string[]>(initial?.tagIds ?? [])
  const [newTag, setNewTag] = useState('')
  const [practiceEnabled, setPracticeEnabled] = useState(initial?.practiceEnabled ?? false)
  const [tagging, setTagging] = useState({ topicId: initial?.topicId ?? '', skillIds: initial?.skillIds ?? [] })
  const [options, setOptions] = useState<Option[]>(
    initial?.options ??
      (initial?.type === 'TRUE_FALSE'
        ? [
            { text: 'True', isCorrect: false },
            { text: 'False', isCorrect: false },
          ]
        : [
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ]),
  )

  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const showOptions = useMemo(() => hasOptions(type), [type])
  const singleCorrect = type === 'MCQ_SINGLE' || type === 'TRUE_FALSE'

  function onTypeChange(next: string) {
    setType(next)
    if (next === 'TRUE_FALSE') {
      setOptions([
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false },
      ])
    } else if (hasOptions(next) && options.length < 2) {
      setOptions([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ])
    }
  }

  function setCorrect(index: number, checked: boolean) {
    setOptions((prev) =>
      prev.map((o, i) =>
        singleCorrect
          ? { ...o, isCorrect: i === index } // radio: only one correct
          : i === index
            ? { ...o, isCorrect: checked }
            : o,
      ),
    )
  }

  async function createTag() {
    const name = newTag.trim()
    if (!name) return
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, name }),
    })
    const json = await res.json()
    if (res.ok && json.success) {
      setTags((t) => [...t, json.data.tag])
      setTagIds((ids) => [...ids, json.data.tag.id])
      setNewTag('')
    } else {
      setError(json?.error?.message ?? 'Could not create tag')
    }
  }

  async function submit() {
    // Mirrors the server: every question needs a topic + at least one skill.
    if (!tagging.topicId || tagging.skillIds.length === 0) {
      setError('Choose a topic and at least one skill — they power students’ strengths & weaknesses.')
      return
    }
    setSaving(true)
    setError(null)

    const payload = {
      orgId,
      type,
      title: title.trim(),
      body: body.trim(),
      difficulty,
      marks: Number(marks),
      negativeMarks: Number(negativeMarks),
      explanation: explanation.trim() || undefined,
      tagIds,
      topicId: tagging.topicId,
      skillIds: tagging.skillIds,
      practiceEnabled,
      options: showOptions ? options.map((o, i) => ({ ...o, text: o.text.trim(), order: i })) : [],
    }

    const url = initial?.id ? `/api/questions/${initial.id}` : '/api/questions'
    const method = initial?.id ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    setSaving(false)

    if (res.ok && json.success) {
      router.push(`/${activeOrg.slug}/questions`)
      router.refresh()
    } else {
      setError(json?.error?.message ?? 'Could not save question')
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Type</label>
        <select className={fieldClass} value={type} onChange={(e) => onTypeChange(e.target.value)}>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Question</label>
        <textarea
          className={cn(fieldClass, 'min-h-24 resize-y')}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      {showOptions && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Options {singleCorrect ? '(pick one correct)' : '(pick all correct)'}
          </label>
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={singleCorrect ? 'radio' : 'checkbox'}
                name="correct"
                checked={opt.isCorrect}
                onChange={(e) => setCorrect(i, e.target.checked)}
                aria-label={`Option ${i + 1} correct`}
              />
              <Input
                value={opt.text}
                readOnly={type === 'TRUE_FALSE'}
                onChange={(e) =>
                  setOptions((prev) => prev.map((o, idx) => (idx === i ? { ...o, text: e.target.value } : o)))
                }
                placeholder={`Option ${i + 1}`}
              />
              {type !== 'TRUE_FALSE' && options.length > 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </Button>
              )}
            </div>
          ))}
          {type !== 'TRUE_FALSE' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => setOptions((prev) => [...prev, { text: '', isCorrect: false }])}
            >
              Add option
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Difficulty</label>
          <select className={fieldClass} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d.toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Marks</label>
          <Input
            type="number"
            min={1}
            value={marks}
            onChange={(e) => setMarks(Number(e.target.value))}
            className="w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Negative marks</label>
          <Input
            type="number"
            min={0}
            step="0.25"
            value={negativeMarks}
            onChange={(e) => setNegativeMarks(Number(e.target.value))}
            className="w-28"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">
          Topic &amp; skills <span className="text-destructive">*</span>
        </label>
        <p className="text-muted-foreground -mt-1 text-xs">
          What this question measures. Scores roll up into each student’s strengths &amp; weaknesses.
        </p>
        <TopicSkillPicker topics={topics} topicId={tagging.topicId} skillIds={tagging.skillIds} onChange={setTagging} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Tags (optional)</label>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const on = tagIds.includes(tag.id)
            return (
              <button
                key={tag.id}
                type="button"
                onClick={() =>
                  setTagIds((ids) => (on ? ids.filter((x) => x !== tag.id) : [...ids, tag.id]))
                }
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-colors',
                  on ? 'bg-accent text-accent-foreground border-transparent' : 'border-current/20',
                )}
              >
                {tag.name}
              </button>
            )
          })}
          {tags.length === 0 && <span className="text-muted-foreground text-xs">No tags yet.</span>}
        </div>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="New tag"
            className="w-48"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void createTag()
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={createTag} disabled={!newTag.trim()}>
            Add tag
          </Button>
        </div>
      </div>

      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors',
          practiceEnabled ? 'border-warning/50 bg-warning/5' : 'border-current/15',
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5"
          checked={practiceEnabled}
          onChange={(e) => setPracticeEnabled(e.target.checked)}
        />
        <span>
          <span className="font-medium">Open for student practice</span>
          <span className="text-muted-foreground block text-xs">
            Students who are weak in this skill can practise it and will see the correct answer and explanation. Use it
            only for practice questions; a test that counts toward analytics can’t include it.
          </span>
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Explanation (optional)</label>
        <textarea
          className={cn(fieldClass, 'min-h-16 resize-y')}
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={saving}>
          {saving ? 'Saving…' : initial?.id ? 'Save changes' : 'Create question'}
        </Button>
        <Button variant="outline" onClick={() => router.push(`/${activeOrg.slug}/questions`)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

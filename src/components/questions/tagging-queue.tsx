'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2 } from 'lucide-react'

import TopicSkillPicker, { type TaxonomyTopic } from '@/components/questions/topic-skill-picker'
import { Button } from '@/components/ui/button'
import { DIFFICULTY_LABEL, QUESTION_TYPE_LABEL, labelOf } from '@/constants/labels'
import { cn } from '@/lib/utils'

type Row = { id: string; title: string; type: string; difficulty: string; tags: string[]; usedIn: number }

/**
 * Plan 021 — bulk-tag untagged questions. Free-form tags are shown as a hint
 * (an imported "DSA, Sorting" usually says exactly where it belongs).
 */
export function TaggingQueue({ orgId, topics, questions }: { orgId: string; topics: TaxonomyTopic[]; questions: Row[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tagging, setTagging] = useState<{ topicId: string; skillIds: string[] }>({ topicId: '', skillIds: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<number | null>(null)

  const allOn = questions.length > 0 && selected.size === questions.length
  const ready = selected.size > 0 && tagging.topicId && tagging.skillIds.length > 0
  const topicName = useMemo(() => topics.find((t) => t.id === tagging.topicId)?.name, [topics, tagging.topicId])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function apply() {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await fetch('/api/questions/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, questionIds: [...selected], topicId: tagging.topicId, skillIds: tagging.skillIds }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not tag questions')
      setDone(json.data.tagged)
      setSelected(new Set())
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (questions.length === 0) {
    return (
      <div className="siq-card siq-rise flex flex-col items-center gap-2 p-10 text-center">
        <CheckCircle2 className="text-success size-8" aria-hidden />
        <p className="font-medium">All caught up</p>
        <p className="text-muted-foreground text-sm">Every question in the bank has a topic and at least one skill.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="siq-card overflow-hidden">
        <label className="border-border/60 flex items-center gap-3 border-b px-4 py-2.5 text-sm font-medium">
          <input
            type="checkbox"
            checked={allOn}
            onChange={() => setSelected(allOn ? new Set() : new Set(questions.map((q) => q.id)))}
          />
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </label>
        <ul className="divide-border/60 max-h-[65vh] divide-y overflow-y-auto">
          {questions.map((q) => (
            <li key={q.id}>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors',
                  selected.has(q.id) ? 'bg-primary/5' : 'hover:bg-muted/40',
                )}
              >
                <input type="checkbox" className="mt-1" checked={selected.has(q.id)} onChange={() => toggle(q.id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{q.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {labelOf(QUESTION_TYPE_LABEL, q.type)} · {labelOf(DIFFICULTY_LABEL, q.difficulty)}
                    {q.usedIn > 0 ? ` · in ${q.usedIn} test${q.usedIn === 1 ? '' : 's'}` : ''}
                    {q.tags.length > 0 ? ` · tags: ${q.tags.join(', ')}` : ''}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <aside className="siq-card flex h-fit flex-col gap-3 p-4 lg:sticky lg:top-20">
        <p className="text-sm font-medium">Tag the selected questions</p>
        <TopicSkillPicker topics={topics} topicId={tagging.topicId} skillIds={tagging.skillIds} onChange={setTagging} compact />
        <Button onClick={apply} disabled={!ready || busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {selected.size > 0 ? `Tag ${selected.size} question${selected.size === 1 ? '' : 's'}` : 'Select questions'}
        </Button>
        {done !== null ? (
          <p className="text-success text-sm" role="status">
            Tagged {done} question{done === 1 ? '' : 's'}
            {topicName ? ` with ${topicName}` : ''}.
          </p>
        ) : null}
        {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
      </aside>
    </div>
  )
}

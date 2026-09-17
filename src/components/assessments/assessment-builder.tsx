'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

/**
 * Plan 012 — the assessment builder.
 *
 * One cohesive client surface over the assessment API: edit settings, manage
 * sections, add questions from the bank (manual or auto-assemble), and publish.
 * Server data arrives as props; each action calls the API then refreshes so the
 * server stays the source of truth.
 *
 * Reordering (drag-and-drop) is deferred — the data model and API carry an
 * `order`, but the builder exposes add/remove for now.
 */

type BankQuestion = { id: string; title: string; type: string; difficulty: string; marks: number }
type Tag = { id: string; name: string }

type SectionQuestion = {
  id: string
  questionId: string
  marksOverride: number | null
  question: { id: string; title: string; type: string; marks: number }
}
type Section = { id: string; title: string; questions: SectionQuestion[] }
type Assessment = {
  id: string
  title: string
  description: string | null
  status: string
  durationMinutes: number
  scoringPolicy: string
  maxAttempts: number
  passingScore: number | null
  /** Plan 018 — proctoring toggles. */
  proctoringEnabled: boolean
  snapshotIntervalSec: number
  storeSnapshots: boolean
  faceMatchThreshold: number
  sections: Section[]
}

const field = 'w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-current/50'

export default function AssessmentBuilder({
  assessment,
  bank,
  tags,
}: {
  assessment: Assessment
  bank: BankQuestion[]
  tags: Tag[]
}) {
  const router = useRouter()
  const org = useActiveOrg()
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // settings
  const [title, setTitle] = useState(assessment.title)
  const [description, setDescription] = useState(assessment.description ?? '')
  const [durationMinutes, setDuration] = useState(assessment.durationMinutes)
  const [scoringPolicy, setScoring] = useState(assessment.scoringPolicy)
  const [maxAttempts, setMaxAttempts] = useState(assessment.maxAttempts)
  // Plan 018 — proctoring
  const [proctoringEnabled, setProctoringEnabled] = useState(assessment.proctoringEnabled)
  const [snapshotIntervalSec, setSnapshotIntervalSec] = useState(assessment.snapshotIntervalSec)
  const [storeSnapshots, setStoreSnapshots] = useState(assessment.storeSnapshots)
  const [faceMatchThreshold, setFaceMatchThreshold] = useState(assessment.faceMatchThreshold)

  const [newSection, setNewSection] = useState('')

  const totalMarks = useMemo(
    () =>
      assessment.sections.reduce(
        (sum, s) => sum + s.questions.reduce((n, q) => n + (q.marksOverride ?? q.question.marks), 0),
        0,
      ),
    [assessment.sections],
  )
  const totalQuestions = assessment.sections.reduce((n, s) => n + s.questions.length, 0)

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Request failed')
      router.refresh()
      return true
    } catch (e) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : 'Request failed' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const base = `/api/assessments/${assessment.id}`

  const saveSettings = async () => {
    if (
      await call(base, 'PATCH', {
        title: title.trim(),
        description: description.trim() || undefined,
        durationMinutes: Number(durationMinutes),
        scoringPolicy,
        maxAttempts: Number(maxAttempts),
        proctoringEnabled,
        snapshotIntervalSec: Number(snapshotIntervalSec),
        storeSnapshots,
        faceMatchThreshold: Number(faceMatchThreshold),
      })
    )
      setMsg({ kind: 'ok', text: 'Settings saved.' })
  }
  const addSection = async () => {
    if (!newSection.trim()) return
    if (await call(`${base}/sections`, 'POST', { title: newSection.trim() })) setNewSection('')
  }
  const publish = async () => {
    if (await call(`${base}/publish`, 'POST')) setMsg({ kind: 'ok', text: 'Published.' })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {/* live summary */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
        <Badge variant={assessment.status === 'PUBLISHED' ? 'secondary' : 'outline'}>
          {assessment.status.toLowerCase()}
        </Badge>
        <span className="text-muted-foreground">
          {assessment.sections.length} sections · {totalQuestions} questions · {totalMarks} marks
        </span>
        <Button variant="outline" className="ml-auto" render={<Link href={`/${org.slug}/assessments/${assessment.id}/assign`} />}>
          Assign
        </Button>
        <Button onClick={publish} disabled={busy}>
          Publish
        </Button>
      </div>

      {msg && (
        <p role="status" className={msg.kind === 'ok' ? 'text-sm text-green-600' : 'text-destructive text-sm'}>
          {msg.text}
        </p>
      )}

      {/* settings */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Settings</h2>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <textarea className={cn(field, 'min-h-16 resize-y')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Duration (min)
            <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDuration(Number(e.target.value))} className="w-28" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Scoring
            <select className={field} value={scoringPolicy} onChange={(e) => setScoring(e.target.value)}>
              <option value="STANDARD">Standard</option>
              <option value="NEGATIVE_MARKING">Negative marking</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Max attempts
            <Input type="number" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="w-24" />
          </label>
        </div>

        {/* Plan 018 — proctoring */}
        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={proctoringEnabled}
              onChange={(e) => setProctoringEnabled(e.target.checked)}
            />
            <span className="font-medium">Enable proctoring</span>
          </label>
          <p className="text-muted-foreground text-xs">
            Requests webcam access when the candidate enters the exam,
            captures a reference photo, and periodically checks for face
            presence and match. Activity events (tab switch, focus loss) are
            also logged.
          </p>
          {proctoringEnabled ? (
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex flex-col gap-1 text-sm">
                Snapshot interval (sec)
                <Input
                  type="number"
                  min={5}
                  max={300}
                  value={snapshotIntervalSec}
                  onChange={(e) => setSnapshotIntervalSec(Number(e.target.value))}
                  className="w-28"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Face match threshold
                <Input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={faceMatchThreshold}
                  onChange={(e) => setFaceMatchThreshold(Number(e.target.value))}
                  className="w-28"
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-1 text-sm">
                <input
                  type="checkbox"
                  checked={storeSnapshots}
                  onChange={(e) => setStoreSnapshots(e.target.checked)}
                />
                Store trigger snapshots
              </label>
            </div>
          ) : null}
        </div>

        <Button variant="outline" onClick={saveSettings} disabled={busy} className="self-start">
          Save settings
        </Button>
      </section>

      <Separator />

      {/* sections */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold">Sections</h2>

        {assessment.sections.map((section) => (
          <SectionEditor
            key={section.id}
            assessmentId={assessment.id}
            section={section}
            bank={bank}
            tags={tags}
            busy={busy}
            onCall={call}
          />
        ))}

        <div className="flex gap-2">
          <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="New section title" className="w-64" />
          <Button variant="outline" onClick={addSection} disabled={busy || !newSection.trim()}>
            Add section
          </Button>
        </div>
      </section>
    </div>
  )
}

function SectionEditor({
  assessmentId,
  section,
  bank,
  tags,
  busy,
  onCall,
}: {
  assessmentId: string
  section: Section
  bank: BankQuestion[]
  tags: Tag[]
  busy: boolean
  onCall: (url: string, method: string, body?: unknown) => Promise<boolean>
}) {
  const [picking, setPicking] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  // auto-assemble criteria
  const [count, setCount] = useState(5)
  const [difficulty, setDifficulty] = useState('')
  const [tagId, setTagId] = useState('')

  const base = `/api/assessments/${assessmentId}`
  const inSection = new Set(section.questions.map((q) => q.questionId))
  const addable = bank.filter((q) => !inSection.has(q.id))

  const addSelected = async () => {
    if (checked.size === 0) return
    if (await onCall(`${base}/sections/${section.id}/questions`, 'POST', { questionIds: [...checked] })) {
      setChecked(new Set())
      setPicking(false)
    }
  }
  const auto = async () => {
    await onCall(`${base}/auto-assemble`, 'POST', {
      sectionId: section.id,
      count: Number(count),
      difficulty: difficulty || undefined,
      tagId: tagId || undefined,
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{section.title}</h3>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => onCall(`${base}/sections/${section.id}`, 'DELETE')}>
          Delete section
        </Button>
      </div>

      {section.questions.length === 0 ? (
        <p className="text-muted-foreground text-sm">No questions in this section yet.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {section.questions.map((q) => (
            <li key={q.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate">{q.question.title}</span>
              <span className="text-muted-foreground text-xs">{q.marksOverride ?? q.question.marks} mk</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  onCall(`${base}/sections/${section.id}/questions?questionId=${q.questionId}`, 'DELETE')
                }
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      {/* auto-assemble */}
      <div className="flex flex-wrap items-end gap-2 rounded-md bg-accent/30 p-2 text-sm">
        <span className="text-muted-foreground">Auto-assemble</span>
        <Input type="number" min={1} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-16" />
        <select className="rounded-md border border-current/20 bg-transparent px-2 py-1 text-sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="">any difficulty</option>
          <option value="EASY">easy</option>
          <option value="MEDIUM">medium</option>
          <option value="HARD">hard</option>
        </select>
        <select className="rounded-md border border-current/20 bg-transparent px-2 py-1 text-sm" value={tagId} onChange={(e) => setTagId(e.target.value)}>
          <option value="">any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button variant="outline" size="sm" disabled={busy} onClick={auto}>
          Add {count}
        </Button>
      </div>

      {/* manual picker */}
      {picking ? (
        <div className="flex flex-col gap-2 rounded-md border p-2">
          <div className="max-h-56 overflow-y-auto">
            {addable.length === 0 ? (
              <p className="text-muted-foreground p-2 text-sm">Nothing left in the bank to add.</p>
            ) : (
              addable.map((q) => (
                <label key={q.id} className="flex items-center gap-2 p-1 text-sm">
                  <input
                    type="checkbox"
                    checked={checked.has(q.id)}
                    onChange={(e) => {
                      const next = new Set(checked)
                      if (e.target.checked) next.add(q.id); else next.delete(q.id)
                      setChecked(next)
                    }}
                  />
                  <span className="flex-1 truncate">{q.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {q.type} · {q.difficulty.toLowerCase()} · {q.marks} mk
                  </span>
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || checked.size === 0} onClick={addSelected}>
              Add {checked.size || ''} selected
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPicking(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setPicking(true)}>
          Add from bank
        </Button>
      )}
    </div>
  )
}

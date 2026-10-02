'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Globe2, Loader2, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Plan 021 — Topics & skills console.
 *
 *   scopeOrgId = a college → its view: the shared platform topics (read-only
 *     names; the college may add its own skills under them) plus the
 *     college's own topics. Editable only by College Admins (canEdit).
 *   scopeOrgId = null → the Super Admin's platform spine.
 *
 * Deletion is only offered for unused items; the server refuses otherwise.
 */

export type ManagerSkill = { id: string; name: string; aliases: string[]; questions: number; editable: boolean }
export type ManagerTopic = {
  id: string
  name: string
  code: string
  description: string | null
  questions: number
  editable: boolean
  platform: boolean
  skills: ManagerSkill[]
}

async function call(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Something went wrong')
  return json.data
}

export function TaxonomyManager({
  scopeOrgId,
  canEdit,
  topics,
}: {
  scopeOrgId: string | null
  canEdit: boolean
  topics: ManagerTopic[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(topics[0]?.id ?? null)
  const totalSkills = topics.reduce((n, t) => n + t.skills.length, 0)

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">
        {topics.length} topic{topics.length === 1 ? '' : 's'} · {totalSkills} skill{totalSkills === 1 ? '' : 's'}.{' '}
        {scopeOrgId
          ? 'Platform topics are shared by every college on SelectIQ so scores compare fairly; you can add your own skills under them, or your own topics.'
          : 'This is the shared spine every college sees. Rename carefully — it changes every college’s reports.'}
      </p>

      {canEdit ? <AddTopic scopeOrgId={scopeOrgId} onAdded={() => router.refresh()} /> : null}

      <div className="flex flex-col gap-2.5">
        {topics.map((t, i) => (
          <TopicCard
            key={t.id}
            topic={t}
            index={i}
            open={open === t.id}
            onToggle={() => setOpen(open === t.id ? null : t.id)}
            scopeOrgId={scopeOrgId}
            canEdit={canEdit}
            onChange={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  )
}

function AddTopic({ scopeOrgId, onAdded }: { scopeOrgId: string | null; onAdded: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setBusy(true)
    setError(null)
    try {
      await call('/api/taxonomy/topics', 'POST', { orgId: scopeOrgId, name, code: code || undefined })
      setName('')
      setCode('')
      onAdded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="siq-card flex flex-col gap-2 p-4">
      <p className="text-sm font-medium">Add a topic</p>
      <div className="flex flex-wrap gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Embedded Systems" className="min-w-0 flex-1 sm:max-w-xs" maxLength={80} />
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code, e.g. EMB" className="w-40" maxLength={40} />
        <Button onClick={add} disabled={busy || name.trim().length < 2}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Add topic
        </Button>
      </div>
      {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}

function TopicCard({
  topic,
  index,
  open,
  onToggle,
  scopeOrgId,
  canEdit,
  onChange,
}: {
  topic: ManagerTopic
  index: number
  open: boolean
  onToggle: () => void
  scopeOrgId: string | null
  canEdit: boolean
  onChange: () => void
}) {
  const [skill, setSkill] = useState('')
  const [aliases, setAliases] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ kind: 'topic' | 'skill'; id: string; name: string } | null>(null)

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      onChange()
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="siq-card siq-rise overflow-hidden" style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="hover:bg-muted/40 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors"
      >
        <span className="bg-primary/10 text-primary grid h-8 min-w-12 place-items-center rounded-lg px-2 font-mono text-[11px] font-semibold">
          {topic.code}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 font-medium">
            {topic.name}
            {topic.platform && scopeOrgId ? (
              <span className="text-muted-foreground inline-flex items-center gap-1 text-[11px] font-normal">
                <Globe2 className="size-3" aria-hidden /> Platform
              </span>
            ) : null}
          </span>
          <span className="text-muted-foreground block text-xs">
            {topic.skills.length} skill{topic.skills.length === 1 ? '' : 's'} · {topic.questions} question
            {topic.questions === 1 ? '' : 's'}
          </span>
        </span>
        <ChevronDown className={cn('text-muted-foreground size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
      </button>

      {open ? (
        <div className="border-border/60 flex flex-col gap-3 border-t px-4 py-3">
          {topic.description ? <p className="text-muted-foreground text-sm">{topic.description}</p> : null}
          <div className="flex flex-wrap gap-1.5">
            {topic.skills.map((s) => (
              <span
                key={s.id}
                title={s.aliases.length ? `Also matches: ${s.aliases.join(', ')}` : undefined}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs',
                  s.editable && scopeOrgId ? 'border-primary/30 bg-primary/5' : 'border-current/15',
                )}
              >
                {s.name}
                {s.questions > 0 ? <span className="text-muted-foreground siq-numeric">· {s.questions}</span> : null}
                {canEdit && s.editable && s.questions === 0 ? (
                  <button
                    type="button"
                    aria-label={`Delete ${s.name}`}
                    onClick={() => setDeleting({ kind: 'skill', id: s.id, name: s.name })}
                    className="text-muted-foreground hover:text-destructive -mr-1 rounded-full p-0.5 transition-colors"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                ) : null}
              </span>
            ))}
            {topic.skills.length === 0 ? <span className="text-muted-foreground text-xs">No skills yet.</span> : null}
          </div>

          {canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input value={skill} onChange={(e) => setSkill(e.target.value)} placeholder="New skill" className="w-48" maxLength={80} />
              <Input
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="Other spellings, comma-separated"
                className="min-w-0 flex-1 sm:max-w-xs"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={busy || skill.trim().length < 2}
                onClick={() =>
                  void run(() =>
                    call('/api/taxonomy/skills', 'POST', { orgId: scopeOrgId, topicId: topic.id, name: skill, aliases }),
                  ).then((ok) => {
                    if (ok) {
                      setSkill('')
                      setAliases('')
                    }
                  })
                }
              >
                <Plus className="size-3.5" aria-hidden /> Add skill
              </Button>
              {topic.editable && topic.questions === 0 && topic.skills.every((s) => s.questions === 0) ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive ml-auto"
                  onClick={() => setDeleting({ kind: 'topic', id: topic.id, name: topic.name })}
                >
                  <Trash2 className="size-3.5" aria-hidden /> Delete topic
                </Button>
              ) : null}
            </div>
          ) : null}
          {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? ''}?`}
        busy={busy}
        error={error}
        confirmLabel={deleting?.kind === 'topic' ? 'Delete topic' : 'Delete skill'}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          void run(() => call(`/api/taxonomy/${deleting.kind === 'topic' ? 'topics' : 'skills'}/${deleting.id}`, 'DELETE')).then(
            (ok) => ok && setDeleting(null),
          )
        }
        body={
          deleting?.kind === 'topic'
            ? 'The topic and its skills are removed. No question uses them.'
            : 'No question uses this skill, so nothing else changes.'
        }
      />
    </section>
  )
}

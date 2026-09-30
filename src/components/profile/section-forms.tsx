'use client'

import { useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Check, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react'

import { Field, SelectInput, TagInput, TextArea, TextInput } from '@/components/profile/fields'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Profile section editors. Each section saves independently (ABtalks
 * pattern) so a student can fill the profile in several short sittings.
 * Scalar sections PATCH /api/profile; repeating sections PUT the whole list
 * to /api/profile/sections/{section}.
 */

type Json = Record<string, unknown>

function useSave() {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  async function save(url: string, method: 'PATCH' | 'PUT', body: Json) {
    setState('saving')
    setError(null)
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not save')
      setState('saved')
      router.refresh()
      setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setState('error')
    }
  }
  return { state, error, save }
}

function SaveBar({ state, error, onSave, label = 'Save' }: { state: string; error: string | null; onSave: () => void; label?: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t pt-5">
      {error ? (
        <p role="alert" className="text-destructive mr-auto text-sm">
          {error}
        </p>
      ) : null}
      {state === 'saved' ? (
        <span className="text-success inline-flex items-center gap-1 text-sm font-medium" role="status">
          <Check className="size-4" aria-hidden /> Saved
        </span>
      ) : null}
      <Button onClick={onSave} disabled={state === 'saving'}>
        {state === 'saving' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </div>
  )
}

const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))

/* ---- scalar sections --------------------------------------------------- */

export function BasicsForm({ initial }: { initial: Json }) {
  const [v, setV] = useState({ name: s(initial.name), headline: s(initial.headline), city: s(initial.city), about: s(initial.about) })
  const { state, error, save } = useSave()
  const set = (k: keyof typeof v) => (x: string) => setV((p) => ({ ...p, [k]: x }))
  return (
    <>
      <div className="grid gap-5">
        <Field label="Full name" required>
          <TextInput value={v.name} onChange={set('name')} maxLength={120} />
        </Field>
        <Field label="Headline" hint={`${v.headline.length}/140`}>
          <TextInput value={v.headline} onChange={set('headline')} maxLength={140} placeholder="Final-year CSE student · Full-stack developer" />
        </Field>
        <Field label="City">
          <TextInput value={v.city} onChange={set('city')} maxLength={80} placeholder="Ghaziabad" />
        </Field>
        <Field label="About you" hint={`${v.about.length}/2000`}>
          <TextArea value={v.about} onChange={set('about')} maxLength={2000} rows={5} placeholder="What you're good at, what you're looking for." />
        </Field>
      </div>
      <SaveBar state={state} error={error} onSave={() => save('/api/profile', 'PATCH', v)} />
    </>
  )
}

export function AcademicsForm({ initial, degrees, years }: { initial: Json; degrees: string[]; years: number[] }) {
  const keys = ['rollNumber', 'degree', 'branch', 'graduationYear', 'cgpa', 'tenthPercent', 'twelfthPercent', 'activeBacklogs'] as const
  const [v, setV] = useState(Object.fromEntries(keys.map((k) => [k, s(initial[k])])) as Record<(typeof keys)[number], string>)
  const { state, error, save } = useSave()
  const set = (k: (typeof keys)[number]) => (x: string) => setV((p) => ({ ...p, [k]: x }))
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Degree" required>
          <SelectInput value={v.degree} onChange={set('degree')} placeholder="Choose degree" options={degrees.map((d) => ({ value: d, label: d }))} />
        </Field>
        <Field label="Branch" required>
          <TextInput value={v.branch} onChange={set('branch')} maxLength={80} placeholder="Computer Science" />
        </Field>
        <Field label="Graduation year" required>
          <SelectInput value={v.graduationYear} onChange={set('graduationYear')} placeholder="Choose year" options={years.map((y) => ({ value: String(y), label: String(y) }))} />
        </Field>
        <Field label="Roll number">
          <TextInput value={v.rollNumber} onChange={set('rollNumber')} maxLength={40} />
        </Field>
        <Field label="CGPA" hint="out of 10">
          <TextInput value={v.cgpa} onChange={set('cgpa')} inputMode="decimal" placeholder="8.2" />
        </Field>
        <Field label="Active backlogs">
          <TextInput value={v.activeBacklogs} onChange={set('activeBacklogs')} inputMode="numeric" placeholder="0" />
        </Field>
        <Field label="Class 10 %">
          <TextInput value={v.tenthPercent} onChange={set('tenthPercent')} inputMode="decimal" placeholder="91.4" />
        </Field>
        <Field label="Class 12 / Diploma %">
          <TextInput value={v.twelfthPercent} onChange={set('twelfthPercent')} inputMode="decimal" placeholder="86" />
        </Field>
      </div>
      <p className="text-muted-foreground mt-4 text-xs">
        Placement cells use these to shortlist for drives. Enter them exactly as on your marksheets.
      </p>
      <SaveBar state={state} error={error} onSave={() => save('/api/profile', 'PATCH', v)} />
    </>
  )
}

const SKILL_SUGGESTIONS = [
  'Java', 'Python', 'C++', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL', 'MongoDB', 'Spring Boot',
  'Data Structures', 'Algorithms', 'DBMS', 'Operating Systems', 'Computer Networks', 'Machine Learning',
  'Git', 'Docker', 'AWS', 'HTML', 'CSS', 'Excel', 'Power BI', 'Communication',
]

export function SkillsForm({ initial }: { initial: string[] }) {
  const [skills, setSkills] = useState(initial)
  const { state, error, save } = useSave()
  return (
    <>
      <Field label="Skills" hint={`${skills.length}/40 · press Enter after each`}>
        <TagInput value={skills} onChange={setSkills} placeholder="e.g. Java, React, SQL" suggestions={SKILL_SUGGESTIONS} />
      </Field>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {SKILL_SUGGESTIONS.filter((x) => !skills.some((k) => k.toLowerCase() === x.toLowerCase()))
          .slice(0, 14)
          .map((x) => (
            <button
              key={x}
              type="button"
              onClick={() => setSkills((p) => (p.length < 40 ? [...p, x] : p))}
              className="text-muted-foreground hover:border-primary/40 hover:text-foreground rounded-full border px-2.5 py-1 text-xs transition-colors"
            >
              + {x}
            </button>
          ))}
      </div>
      <SaveBar state={state} error={error} onSave={() => save('/api/profile', 'PATCH', { skills })} />
    </>
  )
}

export function LinksForm({
  initial,
  userId,
  resume,
}: {
  initial: Json
  userId: string
  resume: { fileName: string | null; uploadedAt: string | null }
}) {
  const [v, setV] = useState({ linkedinUrl: s(initial.linkedinUrl), githubUrl: s(initial.githubUrl), portfolioUrl: s(initial.portfolioUrl), codingUrl: s(initial.codingUrl) })
  const { state, error, save } = useSave()
  const set = (k: keyof typeof v) => (x: string) => setV((p) => ({ ...p, [k]: x }))
  return (
    <>
      <ResumeUpload userId={userId} resume={resume} />
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Field label="LinkedIn">
          <TextInput value={v.linkedinUrl} onChange={set('linkedinUrl')} placeholder="linkedin.com/in/your-name" inputMode="url" />
        </Field>
        <Field label="GitHub">
          <TextInput value={v.githubUrl} onChange={set('githubUrl')} placeholder="github.com/your-name" inputMode="url" />
        </Field>
        <Field label="Portfolio">
          <TextInput value={v.portfolioUrl} onChange={set('portfolioUrl')} placeholder="your-site.dev" inputMode="url" />
        </Field>
        <Field label="Coding profile" hint="LeetCode, CodeChef…">
          <TextInput value={v.codingUrl} onChange={set('codingUrl')} placeholder="leetcode.com/u/your-name" inputMode="url" />
        </Field>
      </div>
      <SaveBar state={state} error={error} onSave={() => save('/api/profile', 'PATCH', v)} label="Save links" />
    </>
  )
}

function ResumeUpload({ userId, resume }: { userId: string; resume: { fileName: string | null; uploadedAt: string | null } }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/profile/resume', { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Upload failed')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  async function remove() {
    if (!window.confirm('Remove your résumé?')) return
    setBusy(true)
    await fetch('/api/profile/resume', { method: 'DELETE' }).catch(() => null)
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">Résumé</p>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed p-4">
        <span className="bg-accent text-primary grid size-10 place-items-center rounded-lg">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {resume.fileName ? (
            <>
              <a href={`/api/profile/${userId}/resume`} target="_blank" rel="noopener noreferrer" className="text-primary block truncate text-sm font-medium hover:underline">
                {resume.fileName}
              </a>
              <p className="text-muted-foreground text-xs">
                Uploaded {resume.uploadedAt ? new Date(resume.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">No résumé yet</p>
              <p className="text-muted-foreground text-xs">PDF, up to 5 MB. Recruiters see this first.</p>
            </>
          )}
        </div>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <div className="flex gap-2">
          {resume.fileName ? (
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-destructive">
              Remove
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {resume.fileName ? 'Replace' : 'Upload PDF'}
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PreferencesForm({ initial }: { initial: Json }) {
  const [roles, setRoles] = useState<string[]>((initial.preferredRoles as string[]) ?? [])
  const [locations, setLocations] = useState<string[]>((initial.preferredLocations as string[]) ?? [])
  const [relocate, setRelocate] = useState<string>(initial.openToRelocate === true ? 'yes' : initial.openToRelocate === false ? 'no' : '')
  const [ctc, setCtc] = useState(s(initial.expectedCtcLpa))
  const { state, error, save } = useSave()
  return (
    <>
      <div className="grid gap-5">
        <Field label="Roles you want" hint="up to 10">
          <TagInput value={roles} onChange={setRoles} max={10} placeholder="Software Engineer, Data Analyst…" />
        </Field>
        <Field label="Preferred locations" hint="up to 10">
          <TagInput value={locations} onChange={setLocations} max={10} placeholder="Noida, Bengaluru, Remote…" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Open to relocating?">
            <SelectInput value={relocate} onChange={setRelocate} placeholder="Choose" options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          </Field>
          <Field label="Expected CTC" hint="lakhs per annum">
            <TextInput value={ctc} onChange={setCtc} inputMode="decimal" placeholder="6" />
          </Field>
        </div>
      </div>
      <SaveBar
        state={state}
        error={error}
        onSave={() =>
          save('/api/profile', 'PATCH', {
            preferredRoles: roles,
            preferredLocations: locations,
            openToRelocate: relocate === '' ? null : relocate === 'yes',
            expectedCtcLpa: ctc,
          })
        }
      />
    </>
  )
}

/* ---- repeating sections ------------------------------------------------ */

export type ListField =
  | { key: string; label: string; kind: 'text' | 'url'; required?: boolean; placeholder?: string; span?: 2 }
  | { key: string; label: string; kind: 'textarea'; placeholder?: string }
  | { key: string; label: string; kind: 'year' | 'month'; placeholder?: string }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; kind: 'tags'; placeholder?: string }
  | { key: string; label: string; kind: 'checkbox' }

/**
 * Generic editor for education / experience / projects / achievements:
 * add, remove, reorder, then save the whole list at once.
 */
export function ListSection({
  section,
  fields,
  initial,
  itemTitle,
  addLabel,
  emptyText,
  max,
}: {
  section: 'education' | 'experience' | 'projects' | 'achievements'
  fields: ListField[]
  initial: Json[]
  itemTitle: (item: Json) => string
  addLabel: string
  emptyText: string
  max: number
}) {
  const blank = () => Object.fromEntries(fields.map((f) => [f.key, f.kind === 'tags' ? [] : f.kind === 'checkbox' ? false : ''])) as Json
  const [items, setItems] = useState<Json[]>(initial.length ? initial.map(normalizeIn(fields)) : [])
  const [open, setOpen] = useState<number | null>(initial.length ? null : null)
  const { state, error, save } = useSave()

  const update = (i: number, k: string, v: unknown) => setItems((p) => p.map((it, j) => (j === i ? { ...it, [k]: v } : it)))
  const move = (i: number, d: -1 | 1) =>
    setItems((p) => {
      const n = [...p]
      const j = i + d
      if (j < 0 || j >= n.length) return p
      ;[n[i], n[j]] = [n[j]!, n[i]!]
      return n
    })

  return (
    <>
      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-center text-sm">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => {
            const isOpen = open === i
            return (
              <li key={i} className={cn('rounded-xl border transition-colors', isOpen && 'border-primary/40')}>
                <div className="flex items-center gap-2 px-4 py-3">
                  <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="min-w-0 flex-1 text-left">
                    <p className="truncate text-sm font-medium">{itemTitle(it) || 'Untitled'}</p>
                    <p className="text-muted-foreground text-xs">{isOpen ? 'Editing' : 'Click to edit'}</p>
                  </button>
                  <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp className="size-4" aria-hidden />
                  </IconBtn>
                  <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                    <ArrowDown className="size-4" aria-hidden />
                  </IconBtn>
                  <IconBtn
                    label="Remove"
                    onClick={() => {
                      setItems((p) => p.filter((_, j) => j !== i))
                      setOpen(null)
                    }}
                    danger
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </IconBtn>
                </div>
                {isOpen ? (
                  <div className="grid gap-4 border-t px-4 py-4 sm:grid-cols-2">
                    {fields.map((f) => (
                      <ListFieldInput key={f.key} field={f} value={it[f.key]} onChange={(v) => update(i, f.key, v)} item={it} />
                    ))}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <Button
        variant="outline"
        className="mt-3"
        disabled={items.length >= max}
        onClick={() => {
          setItems((p) => [...p, blank()])
          setOpen(items.length)
        }}
      >
        <Plus className="size-4" aria-hidden />
        {addLabel}
      </Button>
      <SaveBar state={state} error={error} onSave={() => save(`/api/profile/sections/${section}`, 'PUT', { items: items.map(normalizeOut(fields)) })} />
    </>
  )
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'text-muted-foreground grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-30',
        danger ? 'hover:bg-destructive/10 hover:text-destructive' : 'hover:bg-muted hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ListFieldInput({ field: f, value, onChange, item }: { field: ListField; value: unknown; onChange: (v: unknown) => void; item: Json }) {
  if (f.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="accent-[var(--primary)] size-4" />
        {f.label}
      </label>
    )
  }
  const disabled = f.key === 'endDate' && Boolean(item.current)
  return (
    <Field label={f.label} required={'required' in f && f.required} className={f.kind === 'textarea' || f.kind === 'tags' || ('span' in f && f.span === 2) ? 'sm:col-span-2' : undefined}>
      {f.kind === 'textarea' ? (
        <TextArea value={s(value)} onChange={onChange} rows={3} placeholder={f.placeholder} maxLength={2000} />
      ) : f.kind === 'select' ? (
        <SelectInput value={s(value)} onChange={onChange} options={f.options} />
      ) : f.kind === 'tags' ? (
        <TagInput value={(value as string[]) ?? []} onChange={onChange} max={15} placeholder={f.placeholder} />
      ) : (
        <TextInput
          value={s(value)}
          onChange={onChange}
          type={f.kind === 'month' ? 'month' : 'text'}
          inputMode={f.kind === 'year' ? 'numeric' : f.kind === 'url' ? 'url' : undefined}
          placeholder={'placeholder' in f ? f.placeholder : undefined}
          disabled={disabled}
          maxLength={f.kind === 'year' ? 4 : 200}
        />
      )}
    </Field>
  )
}

/** DB → form: dates to YYYY-MM for month inputs. */
function normalizeIn(fields: ListField[]) {
  return (it: Json): Json => {
    const out: Json = { ...it }
    for (const f of fields) {
      if (f.kind === 'month' && it[f.key]) out[f.key] = String(it[f.key]).slice(0, 7)
      if (f.kind === 'year' && it[f.key] != null) out[f.key] = String(it[f.key])
    }
    return out
  }
}

/** Form → API: only this section's keys; month inputs become the 1st of the month. */
function normalizeOut(fields: ListField[]) {
  return (it: Json): Json => {
    const out: Json = {}
    for (const f of fields) {
      let v = it[f.key]
      if (f.kind === 'month') v = v ? `${String(v)}-01` : null
      if (f.key === 'endDate' && it.current) v = null
      out[f.key] = v
    }
    return out
  }
}

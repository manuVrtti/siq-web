'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Loader2, Plus, ShieldCheck, Trash2, X, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
]

type Dept = { code: string; name: string }
type Result = { org: { id: string; slug: string; name: string }; admins: { email: string; ok: boolean; invited?: boolean; error?: string }[]; departments: number }

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

const STEPS = ['Basics', 'College Admins', 'Departments', 'Review'] as const

/** Super Admin onboarding: one guided flow, one API call, a clear result. */
export function OnboardWizard({ presets }: { presets: Dept[] }) {
  const [step, setStep] = useState(0)
  const [type, setType] = useState<'COLLEGE' | 'COMPANY'>('COLLEGE')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [domain, setDomain] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [admins, setAdmins] = useState<string[]>([''])
  const [depts, setDepts] = useState<Dept[]>([])
  const [custom, setCustom] = useState<Dept>({ code: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const effectiveSlug = slugTouched ? slug : slugify(name)
  const steps = type === 'COLLEGE' ? STEPS : (['Basics', 'Review'] as const)
  const current = steps[step]!
  const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
  const adminList = admins.map((a) => a.trim()).filter(Boolean)

  const canNext = useMemo(() => {
    if (current === 'Basics') return name.trim().length >= 2 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(effectiveSlug) && effectiveSlug.length >= 2
    if (current === 'College Admins') return adminList.length > 0 && adminList.every(emailOk)
    return true
  }, [current, name, effectiveSlug, adminList])

  const toggle = (d: Dept) => setDepts((list) => (list.some((x) => x.code === d.code) ? list.filter((x) => x.code !== d.code) : [...list, d]))

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug: effectiveSlug,
          type,
          domain: domain.trim() || null,
          city: city.trim() || null,
          state: state || null,
          adminEmails: type === 'COLLEGE' ? adminList : [],
          departments: type === 'COLLEGE' ? depts : [],
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not onboard')
      setResult(json.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not onboard')
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <section className="siq-card siq-rise flex flex-col gap-5 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="bg-success text-primary-foreground grid size-11 place-items-center rounded-2xl">
            <Check className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="text-xl font-semibold">{result.org.name} is live</h2>
            <p className="text-muted-foreground text-sm">
              /{result.org.slug} · {result.departments} department{result.departments === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        {result.admins.length ? (
          <ul className="divide-y rounded-xl border">
            {result.admins.map((a) => (
              <li key={a.email} className="flex items-center gap-3 px-4 py-3 text-sm">
                {a.ok ? <CheckCircle2 className="text-success size-4" aria-hidden /> : <XCircle className="text-destructive size-4" aria-hidden />}
                <span className="flex-1 truncate font-medium">{a.email}</span>
                <span className={cn('text-xs', a.ok ? 'text-muted-foreground' : 'text-destructive')}>
                  {a.ok ? (a.invited ? 'Invited — gets access on first sign-in' : 'College Admin now') : a.error}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-muted-foreground text-sm">
          Next: the College Admin signs in with that email, adds HODs and imports students. You can do any of it for them from the
          college page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button render={<Link href={`/admin/organizations/${result.org.id}`} />}>Open college page</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Onboard another
          </Button>
        </div>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                'grid size-7 place-items-center rounded-full text-xs font-semibold transition-colors',
                i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-highlight text-highlight-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span className={cn('text-sm', i === step ? 'font-semibold' : 'text-muted-foreground')}>{s}</span>
            {i < steps.length - 1 ? <span className="bg-border mx-1 h-px w-6" aria-hidden /> : null}
          </li>
        ))}
      </ol>

      <section key={current} className="siq-card siq-rise flex flex-col gap-5 p-6">
        {current === 'Basics' ? (
          <>
            <div role="radiogroup" aria-label="Type" className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['COLLEGE', 'College', 'Students, departments, HODs, placement tests'],
                  ['COMPANY', 'Company', 'Recruiters (marketplace — Phase 2)'],
                ] as const
              ).map(([v, l, b]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={type === v}
                  onClick={() => {
                    setType(v)
                    setStep(0)
                  }}
                  className={cn('rounded-xl border p-4 text-left transition-all', type === v ? 'border-primary bg-accent/50 ring-primary/20 ring-3' : 'hover:border-primary/30')}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <Building2 className="size-4" aria-hidden /> {l}
                  </span>
                  <span className="text-muted-foreground mt-1 block text-xs">{b}</span>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ABES Engineering College" className={inputCls} />
              </Field>
              <Field label="Workspace address" hint={`selectiq…/${effectiveSlug || 'address'}`} required>
                <input
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value.toLowerCase())
                  }}
                  className={inputCls}
                />
              </Field>
              {type === 'COLLEGE' ? (
                <Field label="Student email domain" hint="Students with a verified @domain email join automatically. Leave blank to import only.">
                  <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="abes.ac.in" className={inputCls} />
                </Field>
              ) : null}
              <Field label="City">
                <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ghaziabad" className={inputCls} />
              </Field>
              <Field label="State">
                <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
                  <option value="">Choose…</option>
                  {STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>
          </>
        ) : null}

        {current === 'College Admins' ? (
          <>
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-primary mt-0.5 size-5" aria-hidden />
              <p className="text-muted-foreground text-sm">
                College Admins run the college: HODs, departments, students and tests. Add at least one — two is safer, so the college
                is never locked out. People who haven&apos;t signed in yet are invited and get access on first sign-in.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {admins.map((a, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="email"
                    value={a}
                    onChange={(e) => setAdmins((l) => l.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="placement.officer@college.edu.in"
                    aria-label={`College Admin ${i + 1} email`}
                    className={cn(inputCls, a && !emailOk(a) && 'border-destructive')}
                  />
                  {admins.length > 1 ? (
                    <button type="button" onClick={() => setAdmins((l) => l.filter((_, j) => j !== i))} aria-label="Remove" className="text-muted-foreground hover:text-destructive px-2">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  ) : null}
                </div>
              ))}
              {admins.length < 5 ? (
                <button type="button" onClick={() => setAdmins((l) => [...l, ''])} className="text-primary inline-flex w-fit items-center gap-1 text-sm font-semibold">
                  <Plus className="size-4" aria-hidden /> Add another admin
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {current === 'Departments' ? (
          <>
            <p className="text-muted-foreground text-sm">Pick the college&apos;s departments. HODs and students are organised by them. You can change these any time.</p>
            <div className="flex flex-wrap gap-2">
              {presets.map((d) => {
                const on = depts.some((x) => x.code === d.code)
                return (
                  <button
                    key={d.code}
                    type="button"
                    aria-pressed={on}
                    title={d.name}
                    onClick={() => toggle(d)}
                    className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all', on ? 'bg-primary border-primary text-primary-foreground' : 'hover:border-primary/40')}
                  >
                    {on ? <Check className="size-3.5" aria-hidden /> : null}
                    <b>{d.code}</b>
                    <span className={cn('hidden text-xs sm:inline', on ? 'text-white/80' : 'text-muted-foreground')}>{d.name}</span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={custom.code} onChange={(e) => setCustom((c) => ({ ...c, code: e.target.value.toUpperCase() }))} placeholder="Code" maxLength={12} className={cn(inputCls, 'sm:w-28')} />
              <input value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} placeholder="Another department" className={inputCls} />
              <Button
                type="button"
                variant="outline"
                className="h-10"
                disabled={custom.code.trim().length < 2 || custom.name.trim().length < 2}
                onClick={() => {
                  if (!depts.some((x) => x.code === custom.code.trim())) setDepts((l) => [...l, { code: custom.code.trim(), name: custom.name.trim() }])
                  setCustom({ code: '', name: '' })
                }}
              >
                <Plus className="size-4" aria-hidden /> Add
              </Button>
            </div>
            {depts.filter((d) => !presets.some((p) => p.code === d.code)).length ? (
              <div className="flex flex-wrap gap-2">
                {depts
                  .filter((d) => !presets.some((p) => p.code === d.code))
                  .map((d) => (
                    <span key={d.code} className="bg-accent text-accent-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm">
                      <b>{d.code}</b> {d.name}
                      <button type="button" onClick={() => toggle(d)} aria-label={`Remove ${d.code}`}>
                        <X className="size-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
              </div>
            ) : null}
          </>
        ) : null}

        {current === 'Review' ? (
          <dl className="divide-y rounded-xl border text-sm">
            {[
              ['Organization', `${name} (${type === 'COLLEGE' ? 'college' : 'company'})`],
              ['Address', `/${effectiveSlug}`],
              ['Location', [city, state].filter(Boolean).join(', ') || '—'],
              ...(type === 'COLLEGE'
                ? [
                    ['Student email domain', domain.trim() ? `@${domain.trim().replace(/^@/, '')}` : 'None — import students only'],
                    ['College Admins', adminList.join(', ')],
                    ['Departments', depts.length ? depts.map((d) => d.code).join(', ') : 'None yet'],
                  ]
                : []),
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:gap-6">
                <dt className="text-muted-foreground w-48 shrink-0">{k}</dt>
                <dd className="font-medium break-words">{v}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {error ? <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">{error}</p> : null}

        <div className="flex items-center justify-between border-t pt-4">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" aria-hidden /> Back
            </Button>
          ) : (
            <Button variant="ghost" render={<Link href="/admin/organizations" />}>
              Cancel
            </Button>
          )}
          {current === 'Review' ? (
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Check className="size-4" aria-hidden />}
              Onboard {type === 'COLLEGE' ? 'college' : 'company'}
            </Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
              Next <ArrowRight className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}

const inputCls = 'border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3'

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
    </label>
  )
}

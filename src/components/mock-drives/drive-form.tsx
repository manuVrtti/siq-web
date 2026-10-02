'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Loader2, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Plan 023 — create / edit a mock drive. Mode → employer → role → who can
 * enter → dates. Rounds are added on the drive page after saving.
 */

export type DriveFormInitial = {
  id?: string
  mode: 'COLLEGE_SIMULATED' | 'SAMPLE_COMPANY'
  title: string
  description: string
  employerName: string
  employerLogo: string
  roleTitle: string
  roleCtc: string
  sampleCompanyOrgId: string
  departmentIds: string[]
  batchYears: number[]
  minCgpa: string
  startDate: string
  endDate: string
  registrationDeadline: string
}

const field = 'w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-current/50'

/** <input type="datetime-local"> value → ISO with the browser's offset. */
const toIso = (v: string) => (v ? new Date(v).toISOString() : null)

export function DriveForm({
  orgId,
  slug,
  departments,
  companies,
  collegeWideAllowed,
  initial,
}: {
  orgId: string
  slug: string
  departments: { id: string; code: string; name: string }[]
  companies: { id: string; name: string }[]
  collegeWideAllowed: boolean
  initial?: DriveFormInitial
}) {
  const router = useRouter()
  const [d, setD] = useState<DriveFormInitial>(
    initial ?? {
      mode: 'COLLEGE_SIMULATED',
      title: '',
      description: '',
      employerName: '',
      employerLogo: '',
      roleTitle: '',
      roleCtc: '',
      sampleCompanyOrgId: '',
      departmentIds: collegeWideAllowed ? [] : departments.map((x) => x.id),
      batchYears: [],
      minCgpa: '',
      startDate: '',
      endDate: '',
      registrationDeadline: '',
    },
  )
  const [year, setYear] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof DriveFormInitial>(k: K, v: DriveFormInitial[K]) => setD((x) => ({ ...x, [k]: v }))

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(d.id ? `/api/mock-drives/${d.id}` : '/api/mock-drives', {
        method: d.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          mode: d.mode,
          title: d.title,
          description: d.description || null,
          employerName: d.employerName || null,
          employerLogo: d.employerLogo || null,
          roleTitle: d.roleTitle,
          roleCtc: d.roleCtc || null,
          sampleCompanyOrgId: d.mode === 'SAMPLE_COMPANY' ? d.sampleCompanyOrgId || null : null,
          departmentIds: d.departmentIds,
          batchYears: d.batchYears,
          minCgpa: d.minCgpa === '' ? null : Number(d.minCgpa),
          startDate: toIso(d.startDate),
          endDate: toIso(d.endDate),
          registrationDeadline: toIso(d.registrationDeadline),
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not save the drive')
      router.push(`/${slug}/mock-drives/${json.data.drive.id}`)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  const modes = [
    { v: 'COLLEGE_SIMULATED' as const, icon: Sparkles, title: 'Simulated employer', body: 'You invent the company — e.g. “Infotech Mock Pvt Ltd”. No company account needed.' },
    { v: 'SAMPLE_COMPANY' as const, icon: Building2, title: 'Sample company', body: 'Fronted by a company on SelectIQ. Still practice only — no real hiring.', disabled: companies.length === 0 },
  ]

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <section className="siq-card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">1 · Kind of drive</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {modes.map((m) => (
            <button
              key={m.v}
              type="button"
              disabled={m.disabled}
              onClick={() => set('mode', m.v)}
              className={cn(
                'flex gap-3 rounded-xl border p-4 text-left transition-all disabled:opacity-50',
                d.mode === m.v ? 'border-primary bg-primary/5 ring-primary/20 ring-2' : 'border-current/15 hover:border-current/35',
              )}
            >
              <m.icon className={cn('mt-0.5 size-5 shrink-0', d.mode === m.v ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
              <span>
                <span className="block text-sm font-semibold">{m.title}</span>
                <span className="text-muted-foreground text-xs">{m.disabled ? 'No company organisations on SelectIQ yet.' : m.body}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="siq-card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">2 · Drive &amp; role</h2>
        <label className="flex flex-col gap-1 text-sm">
          Drive title
          <Input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Mock campus drive — Product companies" maxLength={200} />
        </label>
        {d.mode === 'SAMPLE_COMPANY' ? (
          <label className="flex flex-col gap-1 text-sm">
            Sample company
            <select className={field} value={d.sampleCompanyOrgId} onChange={(e) => set('sampleCompanyOrgId', e.target.value)}>
              <option value="">Choose…</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            {d.mode === 'SAMPLE_COMPANY' ? 'Display name (optional)' : 'Employer name'}
            <Input value={d.employerName} onChange={(e) => set('employerName', e.target.value)} placeholder="Infotech Mock Pvt Ltd" maxLength={120} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Logo link (optional)
            <Input value={d.employerLogo} onChange={(e) => set('employerLogo', e.target.value)} placeholder="https://…" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Role
            <Input value={d.roleTitle} onChange={(e) => set('roleTitle', e.target.value)} placeholder="Software Engineer (Mock)" maxLength={120} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            CTC shown to students (optional)
            <Input value={d.roleCtc} onChange={(e) => set('roleCtc', e.target.value)} placeholder="7 LPA (indicative)" maxLength={60} />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          Description (optional)
          <textarea className={cn(field, 'min-h-20 resize-y')} value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="What the drive simulates, the pattern of rounds, any instructions…" />
        </label>
      </section>

      <section className="siq-card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">3 · Who can enter</h2>
        <div className="flex flex-col gap-2 text-sm">
          <span>Departments</span>
          <div className="flex flex-wrap gap-1.5">
            {collegeWideAllowed ? (
              <button
                type="button"
                onClick={() => set('departmentIds', [])}
                className={cn('rounded-full border px-3 py-1 text-xs transition-colors', d.departmentIds.length === 0 ? 'bg-primary text-primary-foreground border-transparent' : 'border-current/20')}
              >
                Whole college
              </button>
            ) : null}
            {departments.map((x) => {
              const on = d.departmentIds.includes(x.id)
              return (
                <button
                  key={x.id}
                  type="button"
                  title={x.name}
                  onClick={() => set('departmentIds', on ? d.departmentIds.filter((i) => i !== x.id) : [...d.departmentIds, x.id])}
                  className={cn('rounded-full border px-3 py-1 text-xs transition-colors', on ? 'bg-primary text-primary-foreground border-transparent' : 'border-current/20')}
                >
                  {x.code}
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1 text-sm">
            Batches (graduation year)
            <div className="flex flex-wrap items-center gap-1.5">
              {d.batchYears.map((y) => (
                <button key={y} type="button" onClick={() => set('batchYears', d.batchYears.filter((x) => x !== y))} className="bg-muted rounded-full px-2.5 py-1 text-xs" title="Remove">
                  {y} ×
                </button>
              ))}
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && year.length === 4) {
                    e.preventDefault()
                    if (!d.batchYears.includes(Number(year))) set('batchYears', [...d.batchYears, Number(year)].sort())
                    setYear('')
                  }
                }}
                placeholder={d.batchYears.length ? 'Add a year' : 'Any batch (type a year)'}
                className="w-52"
              />
            </div>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Minimum CGPA (optional)
            <Input type="number" min={0} max={10} step="0.1" value={d.minCgpa} onChange={(e) => set('minCgpa', e.target.value)} placeholder="e.g. 7" className="w-32" />
          </label>
        </div>
      </section>

      <section className="siq-card flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-semibold">4 · Dates (optional)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['registrationDeadline', 'Registration closes'],
              ['startDate', 'Drive starts'],
              ['endDate', 'Drive ends'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex flex-col gap-1 text-sm">
              {label}
              <input type="datetime-local" className={field} value={d[k]} onChange={(e) => set(k, e.target.value)} />
            </label>
          ))}
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {d.id ? 'Save changes' : 'Create drive — add rounds next'}
        </Button>
        <Button variant="outline" onClick={() => router.back()} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

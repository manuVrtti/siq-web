'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

/**
 * Plan 020 — reusable import wizard: download template → choose file →
 * preview (dry run, nothing written) → confirm (server re-validates and
 * writes only valid rows) → done.
 *
 * Used for questions and candidates; the caller supplies the endpoints and
 * how to describe a row + the summary.
 */

type Row = {
  rowNumber: number
  ok: boolean
  errors?: string[]
  [k: string]: unknown
}

type Step = 'pick' | 'validating' | 'preview' | 'committing' | 'done'

export function ImportWizard({
  kind,
  templateHref,
  validateUrl,
  commitUrl,
  describeRow,
  describeSummary,
  describeDone,
  doneHref,
}: {
  kind: string
  templateHref: string
  validateUrl: string
  commitUrl: string
  describeRow: 'question' | 'candidate'
  describeSummary: 'question' | 'candidate'
  describeDone: 'question' | 'candidate'
  doneHref: string
}) {
  const org = useActiveOrg()
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ rows: Row[]; summary: Record<string, unknown> } | null>(null)
  const [done, setDone] = useState<Record<string, number> | null>(null)
  const [showAll, setShowAll] = useState(false)

  async function send(url: string, f: File) {
    const form = new FormData()
    form.append('orgId', org.id)
    form.append('file', f)
    const res = await fetch(url, { method: 'POST', body: form })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'The server could not process that file')
    return json.data
  }

  async function validate(f: File) {
    setFile(f)
    setError(null)
    setStep('validating')
    try {
      setPreview(await send(validateUrl, f))
      setStep('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed')
      setStep('pick')
    }
  }

  async function commit() {
    if (!file) return
    setError(null)
    setStep('committing')
    try {
      setDone(await send(commitUrl, file))
      setStep('done')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
      setStep('preview')
    }
  }

  function reset() {
    setStep('pick')
    setFile(null)
    setPreview(null)
    setDone(null)
    setError(null)
    setShowAll(false)
    if (input.current) input.current.value = ''
  }

  const s = preview?.summary as Record<string, number & string[]> | undefined
  const rows = preview?.rows ?? []
  const sorted = [...rows].sort((a, b) => Number(a.ok) - Number(b.ok) || a.rowNumber - b.rowNumber)
  const visible = showAll ? sorted : sorted.slice(0, 50)

  return (
    <div className="flex flex-col gap-5">
      {/* Steps */}
      <ol className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium">
        {['Download template', 'Upload', 'Review', 'Import'].map((label, i) => {
          const at = step === 'pick' || step === 'validating' ? 1 : step === 'done' ? 4 : step === 'committing' ? 3 : 2
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'siq-numeric grid size-5 place-items-center rounded-full text-[10px]',
                  i < at ? 'bg-primary text-primary-foreground' : 'bg-muted',
                )}
              >
                {i + 1}
              </span>
              <span className={i < at ? 'text-foreground' : undefined}>{label}</span>
              {i < 3 ? <span className="text-border">—</span> : null}
            </li>
          )
        })}
      </ol>

      {error ? (
        <div role="alert" className="bg-destructive/5 border-destructive/20 text-destructive flex items-start gap-2 rounded-xl border p-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      ) : null}

      {(step === 'pick' || step === 'validating') && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="siq-card flex flex-col gap-3 p-5">
            <p className="text-sm font-semibold">1. Start from the template</p>
            <p className="text-muted-foreground text-sm">
              It has the exact columns, example rows, and an Instructions sheet explaining each
              column.
            </p>
            <Button variant="outline" className="self-start" render={<a href={templateHref} download />}>
              <Download className="size-4" aria-hidden />
              Download {kind} template
            </Button>
          </div>

          <label
            className={cn(
              'siq-card hover:border-primary/50 flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed p-6 text-center transition-colors',
              step === 'validating' && 'pointer-events-none opacity-70',
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files?.[0]
              if (f) void validate(f)
            }}
          >
            <input
              ref={input}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void validate(f)
              }}
            />
            {step === 'validating' ? (
              <>
                <Loader2 className="text-primary size-7 animate-spin" aria-hidden />
                <p className="text-sm font-medium">Checking {file?.name}…</p>
              </>
            ) : (
              <>
                <span className="bg-accent text-primary grid size-11 place-items-center rounded-xl">
                  <Upload className="size-5" aria-hidden />
                </span>
                <p className="text-sm font-semibold">2. Upload your file</p>
                <p className="text-muted-foreground text-xs">
                  Drop an .xlsx, .xls or .csv here, or click to choose. Up to 2,000 rows · 5 MB.
                  Nothing is saved until you confirm.
                </p>
              </>
            )}
          </label>
        </div>
      )}

      {(step === 'preview' || step === 'committing') && s ? (
        <div className="flex flex-col gap-4">
          <div className="siq-card flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
            <FileSpreadsheet className="text-primary size-6" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file?.name}</p>
              <p className="text-muted-foreground text-xs">{summaryLine(describeSummary, s)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset} disabled={step === 'committing'}>
                <RotateCcw className="size-4" aria-hidden />
                Choose another file
              </Button>
              <Button onClick={commit} disabled={step === 'committing' || Number(s.valid) === 0}>
                {step === 'committing' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Import {s.valid} {kind}
                {Number(s.valid) === 1 ? '' : 's'}
              </Button>
            </div>
          </div>

          {Number(s.invalid) > 0 ? (
            <p className="text-warning text-sm">
              {s.invalid} row{Number(s.invalid) === 1 ? '' : 's'} have problems and will be skipped. Fix
              them in the file and upload again, or import the valid rows now.
            </p>
          ) : null}

          <div className="siq-card overflow-hidden">
            <div className="max-h-[460px] overflow-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-muted-foreground text-left text-xs">
                    <th className="px-4 py-2 font-medium">Row</th>
                    <th className="px-4 py-2 font-medium">{describeRow === 'question' ? 'Question' : 'Candidate'}</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.rowNumber} className="border-t align-top">
                      <td className="text-muted-foreground siq-numeric px-4 py-2.5">{r.rowNumber}</td>
                      <td className="px-4 py-2.5">{rowLabel(describeRow, r)}</td>
                      <td className="px-4 py-2.5">
                        {r.ok ? (
                          <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
                            <CheckCircle2 className="size-3.5" aria-hidden />
                            {describeRow === 'candidate' && r.status === 'existing'
                              ? 'Ready · links existing account'
                              : 'Ready'}
                          </span>
                        ) : (
                          <ul className="text-destructive list-inside list-disc text-xs">
                            {(r.errors ?? []).map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sorted.length > 50 && !showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-primary w-full border-t py-2.5 text-xs font-medium hover:underline"
              >
                Show all {sorted.length} rows
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 'done' && done ? (
        <div className="siq-card flex flex-col items-center gap-3 p-10 text-center">
          <span className="bg-success/10 text-success grid size-12 place-items-center rounded-2xl">
            <CheckCircle2 className="size-6" aria-hidden />
          </span>
          <p className="text-base font-semibold">Import complete</p>
          <p className="text-muted-foreground max-w-md text-sm">{doneLine(describeDone, done)}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" onClick={reset}>
              Import another file
            </Button>
            <Button render={<a href={doneHref} />}>Done</Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function rowLabel(kind: 'question' | 'candidate', r: Row) {
  if (kind === 'question') {
    return (
      <>
        <p className="font-medium">{String(r.title || '(no title)')}</p>
        {r.ok && r.type ? (
          <p className="text-muted-foreground text-xs">{String(r.type).replace(/_/g, ' ').toLowerCase()}</p>
        ) : null}
      </>
    )
  }
  const contact = [r.email, r.phone].filter(Boolean).join(' · ')
  return (
    <>
      <p className="font-medium">{String(r.name ?? r.label ?? '—')}</p>
      <p className="text-muted-foreground text-xs">
        {contact}
        {r.batch ? ` · ${String(r.batch)}` : ''}
      </p>
    </>
  )
}

function summaryLine(kind: 'question' | 'candidate', s: Record<string, unknown>) {
  const base = `${s.total} rows · ${s.valid} ready · ${s.invalid} with problems`
  if (kind === 'question') {
    const tags = (s.newTags as string[]) ?? []
    return tags.length ? `${base} · will create ${tags.length} new tag${tags.length === 1 ? '' : 's'}` : base
  }
  const batches = (s.newBatches as string[]) ?? []
  return `${base} · ${s.newAccounts} new, ${s.existingAccounts} existing${
    batches.length ? ` · ${batches.length} new batch${batches.length === 1 ? '' : 'es'}` : ''
  }`
}

function doneLine(kind: 'question' | 'candidate', d: Record<string, number>) {
  if (kind === 'question') {
    return `Added ${d.created} question${d.created === 1 ? '' : 's'} to your bank${
      d.newTags ? ` and created ${d.newTags} tag${d.newTags === 1 ? '' : 's'}` : ''
    }.${d.skipped ? ` ${d.skipped} row${d.skipped === 1 ? ' was' : 's were'} skipped.` : ''}`
  }
  return `Created ${d.created} new account${d.created === 1 ? '' : 's'} and linked ${d.linked} existing${
    d.batchesCreated ? `, plus ${d.batchesCreated} new batch${d.batchesCreated === 1 ? '' : 'es'}` : ''
  }. Candidates claim their account by signing in with the same email or phone.${
    d.skipped ? ` ${d.skipped} row${d.skipped === 1 ? ' was' : 's were'} skipped.` : ''
  }`
}

'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Download, KeyRound, Loader2, MailCheck, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

type Mode = 'temp' | 'email'
type Row = { userId: string; name: string | null; email: string; password?: string }
type Skip = { userId: string; label: string; reason: 'no-email' | 'already-signed-in' | 'failed' }

const CHUNK = 100 // matches MAX_CREDENTIALS_PER_CALL
const REASON: Record<Skip['reason'], string> = {
  'no-email': 'No email on the roster',
  'already-signed-in': 'Already signs in',
  failed: 'Could not be set up — try again',
}

/**
 * "Set up password sign-in" for one or many candidates. Temp mode returns
 * the passwords exactly once: they're turned into a download and held only
 * in this dialog's memory until it closes.
 */
export function CredentialsDialog({ ids, onClose }: { ids: string[]; onClose: () => void }) {
  const org = useActiveOrg()
  const [mode, setMode] = useState<Mode>('temp')
  const [phase, setPhase] = useState<'choose' | 'running' | 'done'>('choose')
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<Row[]>([])
  const [skipped, setSkipped] = useState<Skip[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'running') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, onClose])

  async function run() {
    setPhase('running')
    setError(null)
    const allDone: Row[] = []
    const allSkipped: Skip[] = []
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const res = await fetch('/api/candidates/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: org.id, userIds: ids.slice(i, i + CHUNK), mode }),
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not set up sign-in')
        allDone.push(...json.data.done)
        allSkipped.push(...json.data.skipped)
        setProgress(Math.min(ids.length, i + CHUNK))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    }
    setDone(allDone)
    setSkipped(allSkipped)
    setPhase('done')
    if (mode === 'temp' && allDone.length) void downloadSheet(allDone, org.name)
  }

  const running = phase === 'running'

  return (
    <div
      className="bg-foreground/40 siq-page fixed inset-0 z-50 grid place-items-center p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !running) onClose()
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="cred-title" className="bg-popover siq-rise w-full max-w-lg rounded-2xl border shadow-[var(--shadow-pop)]">
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5">
          <div>
            <h2 id="cred-title" className="text-lg font-semibold">
              Set up password sign-in
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              {ids.length} candidate{ids.length === 1 ? '' : 's'} selected · they&apos;ll sign in with their email and a password
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={running}
            className="text-muted-foreground hover:text-foreground grid size-8 shrink-0 place-items-center rounded-lg"
            aria-label="Close"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {phase === 'choose' ? (
          <div className="flex flex-col gap-3 px-6 py-5">
            <Option
              active={mode === 'temp'}
              onSelect={() => setMode('temp')}
              icon={KeyRound}
              title="Generate temporary passwords"
              body="You download a sheet (shown once) and hand passwords out. Students must choose their own on first sign-in."
            />
            <Option
              active={mode === 'email'}
              onSelect={() => setMode('email')}
              icon={MailCheck}
              title="Email a set-password link"
              body="Each student gets an email to choose a password. Nobody else ever sees it. Needs a working, checked inbox."
            />
            <p className="text-muted-foreground text-xs">
              Only students who haven&apos;t signed in yet and have an email are set up; others are listed after. Running it
              again {mode === 'temp' ? 'issues fresh passwords' : 'sends a fresh link'}.
            </p>
          </div>
        ) : running ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <Loader2 className="text-primary size-8 animate-spin" aria-hidden />
            <p className="text-sm font-medium">
              Setting up {progress} of {ids.length}…
            </p>
            <div className="bg-muted h-2 w-full max-w-xs overflow-hidden rounded-full">
              <div className="bg-primary h-full rounded-full transition-[width] duration-500" style={{ width: `${(progress / ids.length) * 100}%` }} />
            </div>
          </div>
        ) : (
          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-6 py-5">
            {done.length > 0 ? (
              <div className="bg-success/10 flex items-start gap-3 rounded-xl p-4">
                <span className="bg-success text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full">
                  <Check className="size-4" aria-hidden />
                </span>
                <div className="text-sm">
                  <p className="font-semibold">
                    {mode === 'temp' ? `${done.length} temporary password${done.length === 1 ? '' : 's'} created` : `Set-password email sent to ${done.length}`}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {mode === 'temp'
                      ? 'The sheet has downloaded. Share each password privately — students replace it on first sign-in.'
                      : 'Ask students to check their inbox (and spam). The link expires after a while; you can resend any time.'}
                  </p>
                </div>
              </div>
            ) : null}

            {mode === 'temp' && done.length > 0 ? (
              <div className="border-warning/40 bg-warning/5 flex items-start gap-3 rounded-xl border p-4 text-sm">
                <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
                <div className="flex-1">
                  <p>
                    <b>This is the only time these passwords are available.</b> SelectIQ doesn&apos;t store them.
                  </p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={() => void downloadSheet(done, org.name)}>
                    <Download className="size-4" aria-hidden /> Download sheet again
                  </Button>
                </div>
              </div>
            ) : null}

            {skipped.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold">
                  Not set up ({skipped.length})
                </p>
                <ul className="divide-y rounded-xl border text-sm">
                  {skipped.slice(0, 50).map((s) => (
                    <li key={s.userId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate">{s.label}</span>
                      <span className={cn('shrink-0 text-xs', s.reason === 'failed' ? 'text-destructive' : 'text-muted-foreground')}>
                        {REASON[s.reason]}
                      </span>
                    </li>
                  ))}
                  {skipped.length > 50 ? <li className="text-muted-foreground px-3 py-2 text-xs">…and {skipped.length - 50} more</li> : null}
                </ul>
              </div>
            ) : null}

            {error ? <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">{error}</p> : null}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          {phase === 'choose' ? (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={run}>{mode === 'temp' ? 'Generate & download' : 'Send emails'}</Button>
            </>
          ) : (
            <Button onClick={onClose} disabled={running}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Option({
  active,
  onSelect,
  icon: Icon,
  title,
  body,
}: {
  active: boolean
  onSelect: () => void
  icon: typeof KeyRound
  title: string
  body: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-left transition-all',
        active ? 'border-primary bg-accent/50 ring-primary/20 ring-3' : 'hover:border-primary/30 hover:bg-muted/40',
      )}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="text-muted-foreground mt-0.5 block text-sm leading-snug">{body}</span>
      </span>
    </button>
  )
}

async function downloadSheet(rows: Row[], orgName: string) {
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({ Name: r.name ?? '', Email: r.email, 'Temporary password': r.password ?? '' })),
  )
  sheet['!cols'] = [{ wch: 28 }, { wch: 36 }, { wch: 20 }]
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, 'Sign-in')
  const how = XLSX.utils.aoa_to_sheet([
    ['How students sign in'],
    [`1. Open SelectIQ and choose "or with your college email".`],
    ['2. Enter the email and temporary password from this sheet.'],
    ['3. Choose a new password when asked. The temporary one stops working.'],
    [''],
    ['Keep this file private and delete it once passwords are handed out.'],
  ])
  how['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(book, how, 'Instructions')
  const stamp = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(book, `${orgName.replace(/[^\w]+/g, '-')}-sign-in-${stamp}.xlsx`)
}

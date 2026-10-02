'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, FileClock, RotateCcw, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const QUICK = ['Technical problem', 'Power or internet cut', 'Wrong test assigned', 'Testing the flow']

/** Plan 016b — "Allow retake" on the staff grade page. */
export function RetakeButton({ resultId, studentName, nextHref }: { resultId: string; studentName: string; nextHref: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/results/${resultId}/retake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not allow the retake')
      setOpen(false)
      router.push(nextHref)
      router.refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <RotateCcw className="size-3.5" aria-hidden /> Allow retake
      </Button>
      <ConfirmDialog
        open={open}
        tone="primary"
        title={`Allow ${studentName} to retake?`}
        confirmLabel="Allow retake"
        confirmDisabled={reason.trim().length < 3}
        busy={busy}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
        body={
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2.5">
              {[
                { icon: CalendarClock, text: 'The test reopens for the student and they get a notification.' },
                { icon: FileClock, text: 'This attempt is kept for the record (answers, score, integrity log) but stops counting.' },
                { icon: ShieldCheck, text: 'Proctored tests ask for the identity check again. In a mock drive, the round waits for the new score.' },
              ].map((r) => (
                <li key={r.text} className="flex items-start gap-2.5">
                  <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-lg">
                    <r.icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="pt-1">{r.text}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <label htmlFor="retake-reason" className="text-foreground text-sm font-medium">
                Reason <span className="text-muted-foreground font-normal">(shown in the history and audit log)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setReason(q)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-xs transition-colors',
                      reason === q ? 'bg-primary text-primary-foreground border-transparent' : 'hover:bg-muted',
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <Input id="retake-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Or type a reason…" maxLength={300} />
            </div>
          </div>
        }
      />
    </>
  )
}

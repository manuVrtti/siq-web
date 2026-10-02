'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'

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
        title={`Allow ${studentName} to retake this test?`}
        confirmLabel="Allow retake"
        busy={busy}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={() => void confirm()}
        body={
          <div className="flex flex-col gap-2">
            <ul className="list-disc space-y-1 pl-4">
              <li>The test reopens for the student and they get a notification.</li>
              <li>This attempt is kept (answers, score, integrity log) but no longer counts anywhere.</li>
              <li>A proctored test asks for the identity check again. In a mock drive, the round waits for the new score.</li>
            </ul>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason, e.g. power cut during the test" maxLength={300} />
          </div>
        }
      />
    </>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban, Loader2, RotateCcw, ShieldPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

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

/** Suspend / reactivate an account (Super Admin). Suspension is immediate and reversible. */
export function SuspendToggle({ userId, label, suspended, self }: { userId: string; label: string; suspended: boolean; self: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (self) return null

  async function run(method: 'POST' | 'DELETE') {
    setBusy(true)
    setError(null)
    try {
      await call(`/api/admin/users/${userId}/suspend`, method, method === 'POST' ? { reason } : undefined)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  if (suspended) {
    return (
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void run('DELETE')}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
        Reactivate
      </Button>
    )
  }
  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        <Ban className="size-4" aria-hidden /> Suspend
      </Button>
      <ConfirmDialog
        open={open}
        title={`Suspend ${label}?`}
        busy={busy}
        error={error}
        confirmLabel="Suspend account"
        onCancel={() => setOpen(false)}
        onConfirm={() => void run('POST')}
        body={
          <div className="flex flex-col gap-3">
            <ul className="list-disc space-y-1 pl-4">
              <li>They’re signed out everywhere and can’t sign in.</li>
              <li>Nothing is deleted — reactivate any time.</li>
            </ul>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
              placeholder="Reason (kept in the record, optional)"
              className="border-input bg-card text-foreground h-10 rounded-lg border px-3 text-sm outline-none"
            />
          </div>
        }
      />
    </>
  )
}

/** Grant Super Admin by email (existing accounts only). */
export function GrantSuperAdmin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function grant() {
    setBusy(true)
    setMsg(null)
    try {
      await call('/api/admin/super-admins', 'POST', { email })
      setMsg({ ok: true, text: `${email} is now a Super Admin.` })
      setEmail('')
      setConfirming(false)
      router.refresh()
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Could not grant' })
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setConfirming(true)
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="founder@selectiq.in"
          aria-label="Email"
          className="border-input bg-card focus-visible:border-ring h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none"
        />
        <Button type="submit" disabled={!email.trim() || busy} className="h-10">
          <ShieldPlus className="size-4" aria-hidden /> Grant Super Admin
        </Button>
      </div>
      {msg ? <p className={msg.ok ? 'text-success text-sm' : 'text-destructive text-sm'}>{msg.text}</p> : null}
      <ConfirmDialog
        open={confirming}
        title={`Make ${email} a Super Admin?`}
        busy={busy}
        confirmLabel="Grant full access"
        onCancel={() => setConfirming(false)}
        onConfirm={() => void grant()}
        body={
          <ul className="list-disc space-y-1 pl-4">
            <li>They’ll see and manage every college, every person and every result on SelectIQ.</li>
            <li>They can suspend accounts and grant Super Admin to others.</li>
            <li>Only grant this to people who run SelectIQ — never to college staff.</li>
          </ul>
        }
      />
    </form>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getFirebaseAuth } from '@/lib/firebase-client'
import { cn } from '@/lib/utils'

const RULES = [
  { label: '8+ characters', test: (p: string) => p.length >= 8 },
  { label: 'A letter', test: (p: string) => /[a-zA-Z]/.test(p) },
  { label: 'A number', test: (p: string) => /\d/.test(p) },
]

/**
 * Sets the new password server-side (which revokes the temporary session),
 * then signs straight back in with it to mint a fresh session cookie.
 */
export function SetPasswordForm({ email }: { email: string }) {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const passed = RULES.filter((r) => r.test(pw)).length
  const valid = passed === RULES.length && pw === confirm

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: pw }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not set your password')

      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, pw)
      const session = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: await cred.user.getIdToken() }),
      })
      if (!session.ok) throw new Error('Password saved — please sign in again with it.')
      router.replace('/select-org')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="new-pw" className="text-sm font-medium">
          New password
        </label>
        <div className="relative">
          <input
            id="new-pw"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border px-3 pr-11 text-sm outline-none focus-visible:ring-3"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        {/* Strength: three segments that fill as rules pass. */}
        <div className="mt-1 grid grid-cols-3 gap-1.5" aria-hidden>
          {RULES.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-colors duration-300',
                i < passed ? (passed === 3 ? 'bg-success' : 'bg-highlight') : 'bg-muted',
              )}
            />
          ))}
        </div>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {RULES.map((r) => (
            <li key={r.label} className={cn('inline-flex items-center gap-1 transition-colors', r.test(pw) ? 'text-success' : 'text-muted-foreground')}>
              <Check className={cn('size-3.5 transition-opacity', r.test(pw) ? 'opacity-100' : 'opacity-30')} aria-hidden />
              {r.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="confirm-pw" className="text-sm font-medium">
          Confirm password
        </label>
        <input
          id="confirm-pw"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-11 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-3"
        />
        {confirm && confirm !== pw ? <p className="text-destructive text-xs">Passwords don&apos;t match yet</p> : null}
      </div>

      {error ? (
        <p role="alert" className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={!valid || busy} className="mt-1 h-11 rounded-xl text-sm font-semibold">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Save password &amp; continue
      </Button>
    </form>
  )
}

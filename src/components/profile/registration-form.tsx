'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, CheckCircle2, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field, SelectInput, TextInput } from '@/components/profile/fields'

type Values = {
  name: string
  phone: string
  degree: string
  branch: string
  graduationYear: string
  rollNumber: string
}

/**
 * Registration step form. Posts to /api/register; on success either shows
 * "you've joined <college>" (self sign-up matched by email domain) or goes
 * straight on.
 */
export function RegistrationForm({
  initial,
  email,
  college,
  degrees,
  years,
}: {
  initial: Values
  email: string | null
  college: string | null
  degrees: string[]
  years: number[]
}) {
  const router = useRouter()
  const [v, setV] = useState<Values>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [joined, setJoined] = useState<string | null>(null)
  const set = (k: keyof Values) => (value: string) => setV((p) => ({ ...p, [k]: value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not save your details')
      if (json.data.joined) {
        setJoined(json.data.joined.name)
        setTimeout(() => router.replace('/select-org'), 1600)
      } else {
        router.replace('/select-org')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your details')
      setBusy(false)
    }
  }

  if (joined) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="bg-success/10 text-success grid size-12 place-items-center rounded-2xl">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <p className="text-base font-semibold">You&apos;re in</p>
        <p className="text-muted-foreground text-sm">
          We matched your email to <span className="text-foreground font-medium">{joined}</span>.
          Taking you to your dashboard…
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {college ? (
        <div className="bg-accent text-accent-foreground flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
          <Building2 className="size-4 shrink-0" aria-hidden />
          <span>
            Joining as a student of <span className="font-semibold">{college}</span>
          </span>
        </div>
      ) : null}

      <Field label="Full name" hint="As on your college ID" required>
        <TextInput value={v.name} onChange={set('name')} autoComplete="name" maxLength={120} required />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Email">
          <TextInput value={email ?? ''} onChange={() => {}} disabled />
        </Field>
        <Field label="Mobile number" hint="10 digits" required>
          <TextInput value={v.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" maxLength={16} required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Degree" required>
          <SelectInput value={v.degree} onChange={set('degree')} placeholder="Choose degree" options={degrees.map((d) => ({ value: d, label: d }))} />
        </Field>
        <Field label="Branch" hint="e.g. Computer Science" required>
          <TextInput value={v.branch} onChange={set('branch')} maxLength={80} required />
        </Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Graduation year" required>
          <SelectInput value={v.graduationYear} onChange={set('graduationYear')} placeholder="Choose year" options={years.map((y) => ({ value: String(y), label: String(y) }))} />
        </Field>
        <Field label="Roll number" hint="Optional">
          <TextInput value={v.rollNumber} onChange={set('rollNumber')} maxLength={40} />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={busy} className="mt-1">
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Continue
      </Button>
      <p className="text-muted-foreground text-center text-xs">
        Only your college&apos;s placement cell and recruiters it works with can see your profile.
      </p>
    </form>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, MoreHorizontal, Pencil, Trash2, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useActiveOrg } from '@/lib/org-context'

export type RowCandidate = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  /** Never signed in AND only on this college's roster. */
  editable: boolean
  claimed: boolean
}

/** Per-row ⋯ menu on the candidates table: view, edit details, remove. */
export function CandidateRowActions({ candidate: c, profileHref }: { candidate: RowCandidate; profileHref: string }) {
  const [editing, setEditing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const label = c.name ?? c.email ?? c.phone ?? 'this candidate'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`} className="text-muted-foreground" />}
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem render={<Link href={profileHref} />}>
            <UserRound aria-hidden /> View profile
          </DropdownMenuItem>
          {c.editable ? (
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil aria-hidden /> Edit details
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled className="items-start">
              <Lock className="mt-0.5" aria-hidden />
              <span className="flex flex-col">
                Edit details
                <span className="text-muted-foreground text-[11px] leading-snug">
                  {c.claimed ? 'They manage their own details' : 'Also on another college’s roster'}
                </span>
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setRemoving(true)}>
            <Trash2 aria-hidden /> Remove from college
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {editing ? <EditSheet candidate={c} onClose={() => setEditing(false)} /> : null}
      <RemoveDialog
        open={removing}
        ids={[c.id]}
        title={`Remove ${label}?`}
        onDone={() => setRemoving(false)}
        onCancel={() => setRemoving(false)}
      />
    </>
  )
}

function EditSheet({ candidate: c, onClose }: { candidate: RowCandidate; onClose: () => void }) {
  const org = useActiveOrg()
  const router = useRouter()
  const [name, setName] = useState(c.name ?? '')
  const [email, setEmail] = useState(c.email ?? '')
  const [phone, setPhone] = useState(c.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty = name !== (c.name ?? '') || email !== (c.email ?? '') || phone !== (c.phone ?? '')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, name, email, phone }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not save changes')
      router.refresh()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(o) => (!o && !busy ? onClose() : undefined)}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-md">
        <form onSubmit={save} className="flex h-full flex-col">
          <div className="border-b px-6 py-5">
            <SheetTitle className="text-lg font-semibold">Edit candidate</SheetTitle>
            <p className="text-muted-foreground mt-1 text-sm">
              Fix a typo before they sign in. They sign in with the email or phone you set here.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
            <Field label="Full name" htmlFor="c-name">
              <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="e.g. Priya Sharma" className="h-10" />
            </Field>
            <Field label="Email" htmlFor="c-email">
              <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.edu.in" className="h-10" />
            </Field>
            <Field label="Mobile" htmlFor="c-phone" hint="10-digit Indian number; +91 is added automatically.">
              <Input id="c-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210" className="h-10" />
            </Field>
            {error ? <p className="bg-destructive/10 text-destructive rounded-lg px-3 py-2 text-sm font-medium">{error}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={!dirty || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  )
}

/** Shared by the row menu and the bulk bar. */
export function RemoveDialog({
  open,
  ids,
  title,
  onDone,
  onCancel,
}: {
  open: boolean
  ids: string[]
  title: string
  onDone: (removed: number) => void
  onCancel: () => void
}) {
  const org = useActiveOrg()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/candidates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, userIds: ids }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not remove')
      router.refresh()
      onDone(json.data.removed as number)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmDialog
      open={open}
      title={title}
      busy={busy}
      error={error}
      confirmLabel={ids.length === 1 ? 'Remove' : `Remove ${ids.length}`}
      onConfirm={confirm}
      onCancel={() => {
        setError(null)
        onCancel()
      }}
      body={
        <ul className="list-disc space-y-1 pl-4">
          <li>They come off {org.name}&apos;s roster and its batches.</li>
          <li>Exams they haven&apos;t started are withdrawn.</li>
          <li>Exams they&apos;ve already taken, and their results, are kept.</li>
          <li>You can import them again any time.</li>
        </ul>
      }
    />
  )
}

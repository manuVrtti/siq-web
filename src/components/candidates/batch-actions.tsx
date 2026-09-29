'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useActiveOrg } from '@/lib/org-context'

/**
 * Client actions for the batches pages: create a batch, delete a batch,
 * remove a member. Each calls the existing batch API and refreshes the
 * server page; errors show inline, never as a silent no-op.
 */

export function CreateBatchForm() {
  const org = useActiveOrg()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, name, description: description || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Could not create batch')
      setName('')
      setDescription('')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create batch')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Batch name, e.g. CSE 2026 — Section A"
          maxLength={100}
          required
          aria-label="Batch name"
          className="h-9 sm:max-w-xs"
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          maxLength={500}
          aria-label="Batch description"
          className="h-9 flex-1"
        />
        <Button type="submit" disabled={busy || !name.trim()} className="h-9">
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
          Create batch
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </form>
  )
}

export function DeleteBatchButton({
  batchId,
  name,
  redirectTo,
}: {
  batchId: string
  name: string
  redirectTo?: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    // Destructive: confirm. Members, assignments and results are kept.
    if (!window.confirm(`Delete batch "${name}"? Candidates and their results are not affected.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/batches/${batchId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Could not delete batch')
      if (redirectTo) router.push(redirectTo)
      router.refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete batch')
      setBusy(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-destructive">
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
      Delete
    </Button>
  )
}

export function RemoveMemberButton({
  batchId,
  userId,
  label,
}: {
  batchId: string
  userId: string
  label: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      const res = await fetch(`/api/batches/${batchId}/members?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Could not remove')
      router.refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not remove')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 grid size-8 place-items-center rounded-lg transition-colors disabled:opacity-50"
      aria-label={`Remove ${label} from batch`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <X className="size-4" aria-hidden />}
    </button>
  )
}

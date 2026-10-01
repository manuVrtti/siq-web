'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Check, FolderPlus, KeyRound, Loader2, Trash2, X } from 'lucide-react'

import { RemoveDialog } from '@/components/candidates/candidate-row-actions'
import { CredentialsDialog } from '@/components/candidates/credentials-dialog'

import { Button } from '@/components/ui/button'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

/**
 * Bulk selection for the candidates table.
 *
 * The table itself stays a server component; only the checkboxes and the
 * action bar are client islands, sharing selection through this context.
 * Selection is per page — paging or filtering re-renders the server table
 * and clears it (see SelectionProvider `key` in the page).
 */

type Ctx = {
  selected: Set<string>
  pageIds: string[]
  toggle: (id: string) => void
  setAll: (on: boolean) => void
  clear: () => void
}
const SelectionContext = createContext<Ctx | null>(null)

function useSelection() {
  const ctx = useContext(SelectionContext)
  if (!ctx) throw new Error('useSelection must be used inside <SelectionProvider>')
  return ctx
}

export function SelectionProvider({ pageIds, children }: { pageIds: string[]; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const value = useMemo<Ctx>(
    () => ({
      selected,
      pageIds,
      toggle: (id) =>
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        }),
      setAll: (on) => setSelected(on ? new Set(pageIds) : new Set()),
      clear: () => setSelected(new Set()),
    }),
    [selected, pageIds],
  )
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>
}

const boxCls =
  'border-input accent-[var(--primary)] size-4 cursor-pointer rounded align-middle'

export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection()
  return (
    <input
      type="checkbox"
      className={boxCls}
      checked={selected.has(id)}
      onChange={() => toggle(id)}
      aria-label={`Select ${label}`}
    />
  )
}

export function HeaderCheckbox() {
  const { selected, pageIds, setAll } = useSelection()
  const all = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const some = !all && pageIds.some((id) => selected.has(id))
  return (
    <input
      type="checkbox"
      className={boxCls}
      checked={all}
      ref={(el) => {
        if (el) el.indeterminate = some
      }}
      onChange={() => setAll(!all)}
      aria-label="Select all candidates on this page"
    />
  )
}

/**
 * Floating bar shown while anything is selected: add the selection to an
 * existing batch, or create a new batch and add to it in one go.
 */
export function BulkBar({ batches }: { batches: { id: string; name: string }[] }) {
  const { selected, clear } = useSelection()
  const org = useActiveOrg()
  const router = useRouter()
  const [mode, setMode] = useState<'pick' | 'new'>(batches.length ? 'pick' : 'new')
  const [batchId, setBatchId] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [creds, setCreds] = useState(false)

  if (selected.size === 0 && !msg) return null

  async function apply() {
    setBusy(true)
    setMsg(null)
    try {
      let targetId = batchId
      let targetName = batches.find((b) => b.id === batchId)?.name ?? ''
      if (mode === 'new') {
        const res = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId: org.id, name: newName }),
        })
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Could not create batch')
        targetId = json.data.batch.id
        targetName = json.data.batch.name
      }
      if (!targetId) throw new Error('Choose a batch')

      const res = await fetch(`/api/batches/${targetId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [...selected] }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Could not add to batch')

      setMsg({ ok: true, text: `Added ${selected.size} to ${targetName}` })
      clear()
      setNewName('')
      router.refresh()
      setTimeout(() => setMsg(null), 3000)
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong' })
    } finally {
      setBusy(false)
    }
  }

  const canApply = mode === 'pick' ? Boolean(batchId) : newName.trim().length > 0

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="bg-popover fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl flex-wrap items-center gap-3 rounded-2xl border p-3 shadow-[var(--shadow-pop)] sm:inset-x-8"
    >
      {selected.size > 0 ? (
        <>
          <span className="siq-numeric bg-accent text-accent-foreground rounded-lg px-2.5 py-1 text-sm font-semibold">
            {selected.size} selected
          </span>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <FolderPlus className="text-muted-foreground size-4 shrink-0" aria-hidden />
            {mode === 'pick' ? (
              <select
                value={batchId}
                onChange={(e) => {
                  if (e.target.value === '__new') {
                    setMode('new')
                    setBatchId('')
                  } else setBatchId(e.target.value)
                }}
                className="border-input bg-card h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none sm:flex-none"
                aria-label="Batch to add to"
              >
                <option value="">Add to batch…</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
                <option value="__new">+ New batch…</option>
              </select>
            ) : (
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canApply && !busy) void apply()
                }}
                placeholder="New batch name, e.g. CSE 2026"
                maxLength={100}
                className="border-input bg-card h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm outline-none sm:w-56 sm:flex-none"
                aria-label="New batch name"
              />
            )}
            {mode === 'new' && batches.length > 0 ? (
              <button
                type="button"
                onClick={() => setMode('pick')}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Pick existing
              </button>
            ) : null}
            <Button size="sm" onClick={apply} disabled={!canApply || busy}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {mode === 'new' ? 'Create & add' : 'Add'}
            </Button>
          </div>

          <Button size="sm" variant="outline" onClick={() => setCreds(true)}>
            <KeyRound className="size-4" aria-hidden />
            Password sign-in
          </Button>

          <Button
            size="sm"
            variant="destructive"
            onClick={() => setRemoving(true)}
            aria-label={`Remove ${selected.size} selected from college`}
          >
            <Trash2 className="size-4" aria-hidden />
            Remove
          </Button>

          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground grid size-8 place-items-center rounded-lg"
            aria-label="Clear selection"
          >
            <X className="size-4" aria-hidden />
          </button>
        </>
      ) : null}

      {msg ? (
        <p
          role="status"
          className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium',
            msg.ok ? 'text-success' : 'text-destructive',
            selected.size > 0 && 'basis-full',
          )}
        >
          {msg.ok ? <Check className="size-4" aria-hidden /> : null}
          {msg.text}
        </p>
      ) : null}

      {creds ? <CredentialsDialog ids={[...selected]} onClose={() => setCreds(false)} /> : null}

      <RemoveDialog
        open={removing}
        ids={[...selected]}
        title={`Remove ${selected.size} candidate${selected.size === 1 ? '' : 's'}?`}
        onCancel={() => setRemoving(false)}
        onDone={(n) => {
          setRemoving(false)
          clear()
          setMsg({ ok: true, text: `Removed ${n} from the roster` })
          setTimeout(() => setMsg(null), 3000)
        }}
      />
    </div>
  )
}

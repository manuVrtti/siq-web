'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

/**
 * Plan 013 — bulk candidate import (paste-list).
 *
 * The server parses email and phone entries from the raw text, so any of these
 * shapes work: one per line, comma-separated, or a mix. Reports back what was
 * created, claimed (already existed), and what didn't parse.
 */
export default function CandidateImport() {
  const org = useActiveOrg()
  const router = useRouter()
  const [raw, setRaw] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{
    createdUsers: number
    claimedExisting: number
    addedMemberships: number
    invalid: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/candidates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId: org.id, raw }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json?.error?.message ?? 'Import failed')
      setResult(json.data)
      setRaw('')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium">Paste emails or phone numbers</label>
      <textarea
        className={cn(
          'min-h-32 w-full rounded-md border border-current/20 bg-transparent px-3 py-2 font-mono text-sm outline-none focus-visible:border-current/50',
        )}
        placeholder={
          'suyash.2231@abes.ac.in\nasha.2232@abes.ac.in, deep@abes.ac.in\n+919876543210'
        }
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
      />
      <Button onClick={submit} disabled={saving || !raw.trim()} className="self-start">
        {saving ? 'Importing…' : 'Import'}
      </Button>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {result && (
        <div className="text-sm">
          <p>
            <span className="font-medium">{result.createdUsers}</span> new,{' '}
            <span className="font-medium">{result.claimedExisting}</span> already existed,{' '}
            <span className="font-medium">{result.addedMemberships}</span> added to this org.
          </p>
          {result.invalid.length > 0 && (
            <p className="text-muted-foreground mt-1 text-xs">
              Skipped {result.invalid.length} invalid entr
              {result.invalid.length === 1 ? 'y' : 'ies'}:{' '}
              <span className="font-mono">{result.invalid.slice(0, 5).join(', ')}</span>
              {result.invalid.length > 5 && '…'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

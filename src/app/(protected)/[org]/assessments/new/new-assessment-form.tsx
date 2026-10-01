'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useActiveOrg } from '@/lib/org-context'

/** Plan 012 — minimal create; full configuration happens in the builder. */
export default function NewAssessmentForm({
  departments = [],
  required = false,
}: {
  departments?: { id: string; code: string; name: string }[]
  /** HODs must file a test under one of their departments. */
  required?: boolean
}) {
  const router = useRouter()
  const org = useActiveOrg()
  const [title, setTitle] = useState('')
  const [durationMinutes, setDuration] = useState(60)
  const [departmentId, setDepartmentId] = useState(required && departments.length ? departments[0]!.id : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function create() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: org.id,
        title: title.trim(),
        durationMinutes: Number(durationMinutes),
        departmentId: departmentId || undefined,
      }),
    })
    const json = await res.json()
    setSaving(false)
    if (res.ok && json.success) {
      router.push(`/${org.slug}/assessments/${json.data.assessment.id}/build`)
      router.refresh()
    } else {
      setError(json?.error?.message ?? 'Could not create assessment')
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Title</label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. DSA Screening Round 1" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Duration (minutes)</label>
        <Input type="number" min={1} value={durationMinutes} onChange={(e) => setDuration(Number(e.target.value))} className="w-32" />
      </div>
      {departments.length > 0 && (departments.length > 1 || !required) ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor="new-dept">
            Department
          </label>
          <select
            id="new-dept"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            className="border-input bg-card h-9 rounded-lg border px-2.5 text-sm outline-none"
          >
            {!required ? <option value="">College-wide (all departments)</option> : null}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            {required ? 'Only HODs of this department (and College Admins) can edit it.' : 'A department test can also be edited by that department’s HOD.'}
          </p>
        </div>
      ) : null}
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <Button onClick={create} disabled={saving || !title.trim()} className="self-start">
        {saving ? 'Creating…' : 'Create & configure'}
      </Button>
    </div>
  )
}

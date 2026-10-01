'use client'

import { useState } from 'react'
import { Building2, ChevronDown } from 'lucide-react'

import CandidateImport from '@/components/candidates/candidate-import'
import { ImportWizard } from '@/components/import/import-wizard'

/**
 * Import screen body: a department picker (default for rows without a
 * Department column), the spreadsheet wizard and the paste-a-list fallback.
 * HODs must pick one of their departments; admins may leave it empty.
 */
export function CandidateImportPanel({
  departments,
  required,
  base,
}: {
  departments: { id: string; code: string; name: string }[]
  required: boolean
  base: string
}) {
  const [departmentId, setDepartmentId] = useState(required && departments.length ? departments[0]!.id : '')
  const showPicker = departments.length > 0 && (departments.length > 1 || !required)

  return (
    <>
      {showPicker ? (
        <div className="siq-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <span className="bg-accent text-primary grid size-9 shrink-0 place-items-center rounded-xl">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Import into department</p>
            <p className="text-muted-foreground text-xs">Used for rows without a Department column. A row&apos;s own Department wins.</p>
          </div>
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Default department"
            className="border-input bg-card h-10 rounded-lg border px-3 text-sm outline-none sm:w-72"
          >
            {!required ? <option value="">No department (Unassigned)</option> : null}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} — {d.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <ImportWizard
        kind="candidate"
        templateHref="/api/import/candidates/template"
        validateUrl="/api/import/candidates/validate"
        commitUrl="/api/import/candidates/commit"
        describeRow="candidate"
        describeSummary="candidate"
        describeDone="candidate"
        doneHref={base}
        extra={{ departmentId }}
      />

      <details className="siq-card group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Just a few people? Paste a list instead</p>
            <p className="text-muted-foreground text-xs">Emails or phone numbers, one per line or comma-separated.</p>
          </div>
          <ChevronDown className="text-muted-foreground size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="border-t px-5 py-5">
          <CandidateImport departmentId={departmentId} />
        </div>
      </details>
    </>
  )
}

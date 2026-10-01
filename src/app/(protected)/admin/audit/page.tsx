import type { Metadata } from 'next'
import { ScrollText } from 'lucide-react'

import { Initials, Pill } from '@/components/dashboard/bits'
import { DataTable, Pagination, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { shortDateTime } from '@/lib/format'
import { listAudit } from '@/services/audit'

export const metadata: Metadata = { title: 'Audit log — Admin — SelectIQ' }

const ACTIONS = [
  'org.create',
  'org.update',
  'org.member.add',
  'org.member.remove',
  'user.role.change',
  'assessment.publish',
  'result.grade',
  'import.candidates',
  'import.questions',
  'batch.delete',
  'candidate.update',
  'candidate.remove',
  'candidate.credentials',
] as const

/** Who did what, newest first. Read-only; entries are never edited or deleted. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = parseTableParams(await searchParams, { sortable: ['createdAt'] as const, defaultSort: 'createdAt', pageSize: 50 })
  const action = ACTIONS.find((a) => a === p.get('action'))
  const { items, total } = await listAudit({ action, skip: p.skip, take: p.pageSize })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader eyebrow="Governance" title="Audit log" description="Sensitive actions across the platform, newest first." />
      <FilterBar
        showSearch={false}
        filters={[{ key: 'action', label: 'Action', options: ACTIONS.map((a) => ({ value: a, label: a })) }]}
      />
      {items.length === 0 ? (
        <TableEmpty
          filtered={Boolean(action)}
          clearHref="/admin/audit"
          icon={<ScrollText className="size-5" aria-hidden />}
          title="Nothing recorded yet"
          body="Role changes, org edits, imports, publishing and grading appear here as they happen."
        />
      ) : (
        <DataTable minWidth={820} footer={<Pagination pathname="/admin/audit" params={p} total={total} />}>
          <THead>
            <th className={TH}>When</th>
            <th className={TH}>Who</th>
            <th className={TH}>Action</th>
            <th className={TH}>Target</th>
            <th className={TH}>Details</th>
          </THead>
          <tbody>
            {items.map((a) => (
              <TRow key={a.id}>
                <td className={`${TD} text-muted-foreground text-xs whitespace-nowrap`}>{shortDateTime(a.createdAt)}</td>
                <td className={TD}>
                  <div className="flex items-center gap-2">
                    <Initials name={a.user.name} email={a.user.email} />
                    <span className="truncate text-sm">{a.user.name ?? a.user.email}</span>
                  </div>
                </td>
                <td className={TD}>
                  <Pill tone="info">{a.action}</Pill>
                </td>
                <td className={`${TD} text-muted-foreground text-xs`}>
                  {a.entityType}
                  {a.entityId ? <span className="siq-numeric block truncate text-[11px] opacity-70">{a.entityId}</span> : null}
                </td>
                <td className={`${TD} max-w-[320px]`}>
                  {a.metadata ? (
                    <code className="text-muted-foreground block truncate text-[11px]" title={JSON.stringify(a.metadata)}>
                      {JSON.stringify(a.metadata)}
                    </code>
                  ) : null}
                </td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}

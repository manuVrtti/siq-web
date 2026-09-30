import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2 } from 'lucide-react'

import { CreateOrgForm } from '@/components/admin/admin-actions'
import { Panel } from '@/components/analytics/panel'
import { Pill } from '@/components/dashboard/bits'
import { DataTable, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { shortDateTime } from '@/lib/format'
import { listOrganizations } from '@/services/admin'

export const metadata: Metadata = { title: 'Organizations — Admin — SelectIQ' }

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = parseTableParams(await searchParams, { sortable: ['createdAt'] as const, defaultSort: 'createdAt' })
  const type = p.get('type') === 'COLLEGE' || p.get('type') === 'COMPANY' ? (p.get('type') as 'COLLEGE' | 'COMPANY') : undefined
  const orgs = await listOrganizations({ q: p.q || undefined, type })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader eyebrow="Platform" title="Organizations" description={`${orgs.length} shown · colleges and hiring companies`} />

      <Panel eyebrow="New" title="Create an organization">
        <CreateOrgForm />
      </Panel>

      <FilterBar
        searchPlaceholder="Search name, slug or domain…"
        filters={[{ key: 'type', label: 'Type', options: [{ value: 'COLLEGE', label: 'College' }, { value: 'COMPANY', label: 'Company' }] }]}
      />

      {orgs.length === 0 ? (
        <TableEmpty
          filtered={Boolean(p.q || type)}
          clearHref="/admin/organizations"
          icon={<Building2 className="size-5" aria-hidden />}
          title="No organizations yet"
          body="Create the first college above."
        />
      ) : (
        <DataTable minWidth={760}>
          <THead>
            <th className={TH}>Organization</th>
            <th className={TH}>Type</th>
            <th className={TH}>Email domain</th>
            <th className={`${TH} text-right`}>Members</th>
            <th className={`${TH} text-right`}>Assessments</th>
            <th className={`${TH} text-right`}>Created</th>
          </THead>
          <tbody>
            {orgs.map((o) => (
              <TRow key={o.id} href={`/admin/organizations/${o.id}`}>
                <td className={TD}>
                  <Link href={`/admin/organizations/${o.id}`} className="hover:text-primary block font-medium transition-colors">
                    {o.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">/{o.slug}</p>
                </td>
                <td className={TD}>
                  <Pill tone={o.type === 'COLLEGE' ? 'info' : 'muted'}>{o.type === 'COLLEGE' ? 'College' : 'Company'}</Pill>
                </td>
                <td className={`${TD} text-muted-foreground text-xs`}>{o.domain ?? '—'}</td>
                <td className={`${TD} siq-numeric text-right`}>{o._count.members}</td>
                <td className={`${TD} siq-numeric text-right`}>{o._count.assessments}</td>
                <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>{shortDateTime(o.createdAt)}</td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}

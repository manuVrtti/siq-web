import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Download, ExternalLink, Plus } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { DataTable, Pagination, SortHeader, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ORG_SORTS, getOrgDirectory, type OrgHealth } from '@/services/console'

export const metadata: Metadata = { title: 'Colleges & companies — Platform console — SelectIQ' }

const HEALTH: { key: OrgHealth; label: string; tone: string }[] = [
  { key: 'no-admin', label: 'No College Admin', tone: 'bg-destructive/10 text-destructive' },
  { key: 'no-departments', label: 'No departments', tone: 'bg-warning/10 text-warning' },
  { key: 'inactive', label: 'Inactive 30 days', tone: 'bg-muted text-muted-foreground' },
  { key: 'healthy', label: 'Healthy', tone: 'bg-success/10 text-success' },
]

/**
 * The organization directory — built for hundreds of colleges: search,
 * filters (type, status, state, health), sortable columns, paging and an
 * export of exactly what's filtered.
 */
export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = parseTableParams(await searchParams, { sortable: ORG_SORTS, defaultSort: 'createdAt' })
  const type = (['COLLEGE', 'COMPANY'] as const).find((t) => t === p.get('type'))
  const status = (['ACTIVE', 'SUSPENDED'] as const).find((s) => s === p.get('status'))
  const health = HEALTH.find((h) => h.key === p.get('health'))?.key
  const state = p.get('state') || undefined
  const d = await getOrgDirectory({ q: p.q || undefined, type, status, state, health, sort: p.sort, dir: p.dir, skip: p.skip, take: p.pageSize })
  const pathname = '/admin/organizations'
  const exportQs = new URLSearchParams(Object.entries(p.raw).filter(([, v]) => typeof v === 'string' && v) as [string, string][]).toString()

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow="Platform"
        title="Colleges & companies"
        description={`${d.total.toLocaleString('en-IN')} shown · ${d.suspended} suspended`}
        actions={
          <>
            <Button variant="outline" render={<a href={`/api/admin/export/organizations?${exportQs}`} />}>
              <Download className="size-4" aria-hidden /> Export
            </Button>
            <Button render={<Link href="/admin/organizations/new" />}>
              <Plus className="size-4" aria-hidden /> Onboard
            </Button>
          </>
        }
      />

      {/* Health at a glance — each chip filters the table. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {HEALTH.map((h) => {
          const active = health === h.key
          const qs = new URLSearchParams({ ...(active ? {} : { health: h.key }) }).toString()
          return (
            <Link
              key={h.key}
              href={`${pathname}${qs ? `?${qs}` : ''}`}
              className={cn('siq-card siq-lift flex items-center justify-between gap-3 p-4', active && 'ring-primary/30 border-primary ring-3')}
            >
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', h.tone)}>{h.label}</span>
              <span className="font-display text-2xl font-semibold">{d.healthCounts[h.key]}</span>
            </Link>
          )
        })}
      </div>

      <FilterBar
        searchPlaceholder="Search name, address, domain, city or state…"
        filters={[
          { key: 'type', label: 'Type', options: [{ value: 'COLLEGE', label: 'Colleges' }, { value: 'COMPANY', label: 'Companies' }] },
          { key: 'status', label: 'Status', options: [{ value: 'ACTIVE', label: 'Active' }, { value: 'SUSPENDED', label: 'Suspended' }] },
          ...(d.states.length ? [{ key: 'state', label: 'State', options: d.states.map((s) => ({ value: s, label: s })) }] : []),
          { key: 'health', label: 'Health', options: HEALTH.map((h) => ({ value: h.key, label: h.label })) },
        ]}
      />

      {d.items.length === 0 ? (
        <TableEmpty
          filtered={Boolean(p.q || type || status || state || health)}
          clearHref={pathname}
          icon={<Building2 className="size-5" aria-hidden />}
          title="No organizations yet"
          body="Onboard your first college: its College Admins and departments in one go."
          action={
            <Button size="sm" render={<Link href="/admin/organizations/new" />}>
              Onboard a college
            </Button>
          }
        />
      ) : (
        <DataTable minWidth={1040} footer={<Pagination pathname={pathname} params={p} total={d.total} />}>
          <THead>
            <SortHeader label="Organization" field="name" pathname={pathname} params={p} />
            <th className={TH}>Health</th>
            <SortHeader label="Students" field="students" pathname={pathname} params={p} align="right" />
            <th className={`${TH} text-right`}>Admins</th>
            <th className={`${TH} text-right`}>HODs</th>
            <th className={`${TH} text-right`}>Depts</th>
            <th className={`${TH} text-right`}>Tests</th>
            <SortHeader label="Last activity" field="activity" pathname={pathname} params={p} align="right" />
            <SortHeader label="Onboarded" field="createdAt" pathname={pathname} params={p} align="right" />
            <th className={`${TH} w-10`}>
              <span className="sr-only">Open workspace</span>
            </th>
          </THead>
          <tbody>
            {d.items.map((o) => {
              const h = HEALTH.find((x) => x.key === o.health)!
              return (
                <TRow key={o.id} href={`${pathname}/${o.id}`}>
                  <td className={TD}>
                    <Link href={`${pathname}/${o.id}`} className="hover:text-primary block font-medium transition-colors">
                      {o.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      /{o.slug}
                      {o.city || o.state ? ` · ${[o.city, o.state].filter(Boolean).join(', ')}` : ''}
                      {o.type === 'COMPANY' ? ' · company' : ''}
                    </p>
                  </td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {o.status === 'SUSPENDED' ? <Pill tone="danger">Suspended</Pill> : null}
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', h.tone)}>{h.label}</span>
                    </div>
                  </td>
                  <td className={`${TD} siq-numeric text-right`}>{o.students.toLocaleString('en-IN')}</td>
                  <td className={cn(TD, 'siq-numeric text-right', o.type === 'COLLEGE' && o.admins === 0 && 'text-destructive font-semibold')}>{o.admins}</td>
                  <td className={`${TD} siq-numeric text-right`}>{o.hods}</td>
                  <td className={`${TD} siq-numeric text-right`}>{o.departments}</td>
                  <td className={`${TD} siq-numeric text-right`}>
                    {o.tests}
                    {o.liveTests ? <span className="text-muted-foreground text-xs"> · {o.liveTests} live</span> : null}
                  </td>
                  <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                    {o.lastActivity ? timeAgo(o.lastActivity) : 'Never'}
                    {o.submissions7d ? <span className="text-success block">{o.submissions7d} this week</span> : null}
                  </td>
                  <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>{timeAgo(o.createdAt)}</td>
                  <td className={`${TD} w-10 text-right`}>
                    <Link href={`/${o.slug}/${o.type === 'COLLEGE' ? 'manage' : 'dashboard'}`} aria-label={`Open ${o.name}`} className="text-muted-foreground hover:text-primary">
                      <ExternalLink className="size-4" aria-hidden />
                    </Link>
                  </td>
                </TRow>
              )
            })}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}

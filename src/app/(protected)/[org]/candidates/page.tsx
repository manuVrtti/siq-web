import type { Metadata } from 'next'
import Link from 'next/link'
import { FolderKanban, UserPlus, Users } from 'lucide-react'

import {
  BulkBar,
  HeaderCheckbox,
  RowCheckbox,
  SelectionProvider,
} from '@/components/candidates/candidate-selection'
import { CandidateRowActions } from '@/components/candidates/candidate-row-actions'
import { Initials, Pill } from '@/components/dashboard/bits'
import {
  DataTable,
  Pagination,
  SortHeader,
  TD,
  TH,
  THead,
  TRow,
  TableEmpty,
} from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { CANDIDATE_SORTS, listBatches, listCandidates } from '@/services/candidates'
import { requirePageScope } from '@/lib/auth/page-guard'
import { listScopeDepartments, studentWhere } from '@/lib/auth/scope'
import { PERMISSIONS } from '@/constants/permissions'

export const metadata: Metadata = { title: 'Candidates — SelectIQ' }

/**
 * Plan 013, redesigned in plan 019 Phase 3 — the candidate roster as a real
 * table. Import sits in a collapsible panel: it's used when onboarding a
 * batch, not on every visit, so it shouldn't push the roster below the fold.
 * It opens by default only when the roster is empty.
 */
export default async function CandidatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<SearchParams>
}) {
  // Managers only — [org]/layout proves membership, and students are members.
  const { org: slug } = await params
  const { org, scope } = await requirePageScope(PERMISSIONS.MANAGE_ORG_USERS, slug)

  const p = parseTableParams(await searchParams, {
    sortable: CANDIDATE_SORTS,
    defaultSort: 'createdAt',
  })
  const batchId = p.get('batch')
  const departmentId = p.get('dept')
  const status = p.get('status') === 'active' || p.get('status') === 'pending'
    ? (p.get('status') as 'active' | 'pending')
    : undefined

  const [{ items, total }, batches, rosterSize, pendingCount, departments] = await Promise.all([
    listCandidates(scope, {
      search: p.q || undefined,
      batchId,
      departmentId,
      status,
      sort: p.sort,
      dir: p.dir,
      skip: p.skip,
      take: p.pageSize,
    }),
    listBatches(scope),
    prisma.user.count({ where: studentWhere(scope) }),
    prisma.user.count({ where: { ...studentWhere(scope), firebaseUid: { startsWith: 'pending:' } } }),
    listScopeDepartments(scope),
  ])

  const pathname = `/${slug}/candidates`
  const filtered = Boolean(p.q || batchId || status || departmentId)

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={org.name}
        title="Candidates"
        description={
          <>
            {rosterSize.toLocaleString('en-IN')} on the roster ·{' '}
            {(rosterSize - pendingCount).toLocaleString('en-IN')} signed in ·{' '}
            {pendingCount.toLocaleString('en-IN')} yet to sign in · {batches.length} batch
            {batches.length === 1 ? '' : 'es'}
          </>
        }
        actions={
          <>
            <Button variant="outline" render={<Link href={`${pathname}/batches`} />}>
              <FolderKanban className="size-4" aria-hidden />
              Manage batches
            </Button>
            <Button render={<Link href={`${pathname}/import`} />}>
              <UserPlus className="size-4" aria-hidden />
              Import candidates
            </Button>
          </>
        }
      />


      <FilterBar
        searchPlaceholder="Search name, email or phone…"
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: [
              { value: 'active', label: 'Signed in' },
              { value: 'pending', label: 'Yet to sign in' },
            ],
          },
          ...(departments.length > 1 || (scope.all && departments.length > 0)
            ? [
                {
                  key: 'dept',
                  label: 'Department',
                  options: [
                    ...departments.map((d) => ({ value: d.id, label: d.code })),
                    ...(scope.all ? [{ value: 'none', label: 'Unassigned' }] : []),
                  ],
                },
              ]
            : []),
          ...(batches.length > 0
            ? [
                {
                  key: 'batch',
                  label: 'Batch',
                  options: batches.map((b) => ({
                    value: b.id,
                    label: `${b.name} (${b._count.members})`,
                  })),
                },
              ]
            : []),
        ]}
      />

      {items.length === 0 ? (
        <TableEmpty
          filtered={filtered}
          clearHref={pathname}
          icon={<Users className="size-5" aria-hidden />}
          title="No candidates yet"
          body="Import your college's roster from a spreadsheet to get started."
          action={
            <Button size="sm" render={<Link href={`${pathname}/import`} />}>
              Import candidates
            </Button>
          }
        />
      ) : (
        // key = current query, so paging / filtering resets the selection.
        <SelectionProvider key={JSON.stringify(p.raw)} pageIds={items.map((c) => c.id)}>
        <DataTable minWidth={800} footer={<Pagination pathname={pathname} params={p} total={total} />}>
          <THead>
            <th className={`${TH} w-10 pr-0`}>
              <HeaderCheckbox />
            </th>
            <SortHeader label="Candidate" field="name" pathname={pathname} params={p} />
            <th className={TH}>Department</th>
            <th className={TH}>Batches</th>
            <th className={`${TH} text-right`}>Exams</th>
            <th className={TH}>Status</th>
            <SortHeader label="Last active" field="lastLoginAt" pathname={pathname} params={p} align="right" />
            <SortHeader label="Added" field="createdAt" pathname={pathname} params={p} align="right" />
            <th className={`${TH} w-12`}>
              <span className="sr-only">Actions</span>
            </th>
          </THead>
          <tbody>
            {items.map((c) => (
              <TRow key={c.id}>
                <td className={`${TD} w-10 pr-0`}>
                  <RowCheckbox id={c.id} label={c.name ?? c.email ?? c.phone ?? 'candidate'} />
                </td>
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Initials name={c.name} email={c.email} />
                    <div className="min-w-0">
                      <Link
                        href={`${pathname}/${c.id}`}
                        className="hover:text-primary block truncate font-medium transition-colors"
                      >
                        {c.name ?? c.email ?? c.phone}
                      </Link>
                      <p className="text-muted-foreground truncate text-xs">
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={TD}>
                  {c.department ? (
                    <span title={c.department.name} className="bg-accent text-accent-foreground rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
                      {c.department.code}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Unassigned</span>
                  )}
                </td>
                <td className={TD}>
                  {c.batchMemberships.length === 0 ? (
                    <span className="text-muted-foreground text-xs">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {c.batchMemberships.map(({ batch }) => (
                        <span
                          key={batch.id}
                          className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px]"
                        >
                          {batch.name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td className={`${TD} siq-numeric text-right`}>{c._count.assignments}</td>
                <td className={TD}>
                  {c.claimed ? (
                    <Pill tone="success">Signed in</Pill>
                  ) : (
                    <Pill tone="muted">Yet to sign in</Pill>
                  )}
                </td>
                <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                  {c.lastLoginAt ? timeAgo(c.lastLoginAt) : 'Never'}
                </td>
                <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>
                  {timeAgo(c.createdAt)}
                </td>
                <td className={`${TD} w-12 pl-0 text-right`}>
                  <CandidateRowActions
                    profileHref={`${pathname}/${c.id}`}
                    candidate={{ id: c.id, name: c.name, email: c.email, phone: c.phone, editable: c.editable, claimed: c.claimed }}
                  />
                </td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
        <BulkBar
          batches={batches.map((b) => ({ id: b.id, name: b.name }))}
          departments={departments}
          canUnassign={scope.all}
        />
        </SelectionProvider>
      )}
    </div>
  )
}

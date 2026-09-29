import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ChevronDown, UserPlus, Users } from 'lucide-react'

import CandidateImport from '@/components/candidates/candidate-import'
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
import { timeAgo } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { CANDIDATE_SORTS, listBatches, listCandidates } from '@/services/candidates'
import { getOrgBySlug } from '@/services/organizations'

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
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const p = parseTableParams(await searchParams, {
    sortable: CANDIDATE_SORTS,
    defaultSort: 'createdAt',
  })
  const batchId = p.get('batch')
  const status = p.get('status') === 'active' || p.get('status') === 'pending'
    ? (p.get('status') as 'active' | 'pending')
    : undefined

  const pendingWhere = {
    role: 'STUDENT' as const,
    memberships: { some: { orgId: org.id } },
    firebaseUid: { startsWith: 'pending:' },
  }
  const [{ items, total }, batches, rosterSize, pendingCount] = await Promise.all([
    listCandidates(org.id, {
      search: p.q || undefined,
      batchId,
      status,
      sort: p.sort,
      dir: p.dir,
      skip: p.skip,
      take: p.pageSize,
    }),
    listBatches(org.id),
    prisma.user.count({ where: { role: 'STUDENT', memberships: { some: { orgId: org.id } } } }),
    prisma.user.count({ where: pendingWhere }),
  ])

  const pathname = `/${slug}/candidates`
  const filtered = Boolean(p.q || batchId || status)

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
      />

      <details className="siq-card group" open={rosterSize === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="bg-accent text-primary grid size-9 place-items-center rounded-lg">
            <UserPlus className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Import candidates</p>
            <p className="text-muted-foreground text-xs">
              Paste emails or phone numbers. Candidates sign in with the same email to claim their
              account.
            </p>
          </div>
          <ChevronDown
            className="text-muted-foreground size-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="border-t px-5 py-5">
          <CandidateImport />
        </div>
      </details>

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
          body="Use Import candidates above to add your college's roster."
        />
      ) : (
        <DataTable minWidth={760} footer={<Pagination pathname={pathname} params={p} total={total} />}>
          <THead>
            <SortHeader label="Candidate" field="name" pathname={pathname} params={p} />
            <th className={TH}>Batches</th>
            <th className={`${TH} text-right`}>Exams</th>
            <th className={TH}>Status</th>
            <SortHeader label="Last active" field="lastLoginAt" pathname={pathname} params={p} align="right" />
            <SortHeader label="Added" field="createdAt" pathname={pathname} params={p} align="right" />
          </THead>
          <tbody>
            {items.map((c) => (
              <TRow key={c.id}>
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Initials name={c.name} email={c.email} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.name ?? c.email ?? c.phone}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
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
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}

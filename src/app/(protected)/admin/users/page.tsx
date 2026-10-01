import type { Metadata } from 'next'
import Link from 'next/link'
import { Users } from 'lucide-react'

import { RoleSelect } from '@/components/admin/admin-actions'
import { Initials, Pill } from '@/components/dashboard/bits'
import { DataTable, Pagination, TD, TH, THead, TRow, TableEmpty } from '@/components/data/data-table'
import { FilterBar } from '@/components/data/filter-bar'
import { ListHeader } from '@/components/data/list-header'
import { parseTableParams, type SearchParams } from '@/components/data/table-params'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { timeAgo } from '@/lib/format'
import { listUsers } from '@/services/admin'

export const metadata: Metadata = { title: 'Users — Admin — SelectIQ' }

const ROLES = ['STUDENT', 'COLLEGE_HOD', 'COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = (await getCurrentUser())!
  const p = parseTableParams(await searchParams, { sortable: ['createdAt'] as const, defaultSort: 'createdAt' })
  const role = ROLES.find((r) => r === p.get('role'))
  const { items, total } = await listUsers({ q: p.q || undefined, role, skip: p.skip, take: p.pageSize })

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow="Platform"
        title="Users"
        description="Everyone on SelectIQ. Changing a role is audited; you can't change your own."
      />
      <FilterBar
        searchPlaceholder="Search name, email or phone…"
        filters={[
          {
            key: 'role',
            label: 'Role',
            options: ROLES.map((r) => ({ value: r, label: r.replace('_', ' ').toLowerCase() })),
          },
        ]}
      />
      {items.length === 0 ? (
        <TableEmpty filtered={Boolean(p.q || role)} clearHref="/admin/users" icon={<Users className="size-5" aria-hidden />} title="No users yet" />
      ) : (
        <DataTable minWidth={820} footer={<Pagination pathname="/admin/users" params={p} total={total} />}>
          <THead>
            <th className={TH}>User</th>
            <th className={TH}>Organizations</th>
            <th className={TH}>Status</th>
            <th className={`${TH} text-right`}>Joined</th>
            <th className={`${TH} text-right`}>Role</th>
          </THead>
          <tbody>
            {items.map((u) => (
              <TRow key={u.id}>
                <td className={TD}>
                  <div className="flex items-center gap-3">
                    <Initials name={u.name} email={u.email} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.name ?? u.email ?? u.phone}</p>
                      <p className="text-muted-foreground truncate text-xs">{[u.email, u.phone].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                </td>
                <td className={TD}>
                  {u._count.memberships === 0 ? (
                    <span className="text-muted-foreground text-xs">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {u.memberships.map(({ org }) => (
                        <Link key={org.id} href={`/admin/organizations/${org.id}`} className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 text-[11px] transition-colors">
                          {org.name}
                        </Link>
                      ))}
                      {u._count.memberships > u.memberships.length ? (
                        <span className="text-muted-foreground text-[11px]">+{u._count.memberships - u.memberships.length}</span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className={TD}>
                  {u.claimed ? (
                    <span className="text-muted-foreground text-xs">{u.lastLoginAt ? `Active ${timeAgo(u.lastLoginAt)}` : 'Signed in'}</span>
                  ) : (
                    <Pill tone="muted">Invited</Pill>
                  )}
                </td>
                <td className={`${TD} text-muted-foreground text-right text-xs whitespace-nowrap`}>{timeAgo(u.createdAt)}</td>
                <td className={`${TD} text-right`}>
                  <RoleSelect userId={u.id} role={u.role} self={u.id === me.id} />
                </td>
              </TRow>
            ))}
          </tbody>
        </DataTable>
      )}
    </div>
  )
}

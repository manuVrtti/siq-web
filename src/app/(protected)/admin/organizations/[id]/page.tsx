import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'

import { AddMemberForm, EditOrgForm, RemoveMemberButton } from '@/components/admin/admin-actions'
import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { Initials, Pill } from '@/components/dashboard/bits'
import { DataTable, TD, TH, THead, TRow } from '@/components/data/data-table'
import { ListHeader } from '@/components/data/list-header'
import { Button } from '@/components/ui/button'
import { NotFoundError } from '@/lib/errors'
import { timeAgo } from '@/lib/format'
import { getOrganizationDetail } from '@/services/admin'

export const metadata: Metadata = { title: 'Organization — Admin — SelectIQ' }

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let org
  try {
    org = await getOrganizationDetail(id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const students = org.members.filter((m) => m.user.role === 'STUDENT').length

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <ListHeader
        eyebrow={
          <Link href="/admin/organizations" className="hover:text-foreground">
            Organizations
          </Link>
        }
        title={org.name}
        description={`/${org.slug} · ${org.type === 'COLLEGE' ? 'College' : 'Company'}`}
        actions={
          <Button variant="outline" render={<Link href={`/${org.slug}/dashboard`} />}>
            Open workspace
            <ExternalLink className="size-4" aria-hidden />
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Members" value={org.members.length} hint={`${students} students`} />
        <StatCard label="Assessments" value={org._count.assessments} />
        <StatCard label="Questions" value={org._count.questions} />
        <StatCard label="Batches" value={org._count.batches} />
      </div>

      <Panel eyebrow="Settings" title="Details">
        <EditOrgForm id={org.id} name={org.name} domain={org.domain} />
      </Panel>

      <Panel eyebrow="People" title="Add a member">
        <AddMemberForm orgId={org.id} />
      </Panel>

      <DataTable minWidth={680}>
        <THead>
          <th className={TH}>Member</th>
          <th className={TH}>Platform role</th>
          <th className={TH}>Org role</th>
          <th className={`${TH} text-right`}>Last sign-in</th>
          <th className={`${TH} text-right`}>
            <span className="sr-only">Remove</span>
          </th>
        </THead>
        <tbody>
          {org.members.map((m) => (
            <TRow key={m.user.id}>
              <td className={TD}>
                <div className="flex items-center gap-3">
                  <Initials name={m.user.name} email={m.user.email} />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.user.name ?? m.user.email}</p>
                    <p className="text-muted-foreground truncate text-xs">{m.user.email}</p>
                  </div>
                </div>
              </td>
              <td className={TD}>
                <Pill tone={m.user.role === 'STUDENT' ? 'muted' : 'info'}>{m.user.role.replace('_', ' ').toLowerCase()}</Pill>
              </td>
              <td className={`${TD} text-muted-foreground text-xs`}>{m.role === 'ADMIN' ? 'Org admin' : 'Member'}</td>
              <td className={`${TD} text-muted-foreground text-right text-xs`}>
                {m.user.firebaseUid.startsWith('pending:') ? 'Never (invited)' : m.user.lastLoginAt ? timeAgo(m.user.lastLoginAt) : '—'}
              </td>
              <td className={`${TD} text-right`}>
                <RemoveMemberButton orgId={org.id} userId={m.user.id} label={m.user.name ?? m.user.email ?? 'member'} />
              </td>
            </TRow>
          ))}
        </tbody>
      </DataTable>
    </div>
  )
}

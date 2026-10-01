import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'

import { RoleSelect } from '@/components/admin/admin-actions'
import { GrantSuperAdmin } from '@/components/admin/user-actions'
import { Panel } from '@/components/analytics/panel'
import { Initials } from '@/components/dashboard/bits'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { timeAgo } from '@/lib/format'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Platform admins — SelectIQ' }

/**
 * Who has full platform access. Granting is by email (existing accounts);
 * revoking is a role change. The platform always keeps one active Super
 * Admin, and nobody can change their own role.
 */
export default async function PlatformAdminsPage() {
  const me = (await getCurrentUser())!
  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, email: true, lastLoginAt: true, suspendedAt: true },
  })
  const grants = await prisma.auditLog.findMany({
    where: { action: { in: ['superadmin.grant', 'user.role.change'] } },
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true, action: true, createdAt: true, metadata: true, entityId: true, user: { select: { name: true, email: true } } },
  })

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageIntro icon={ShieldCheck} title="Platform admins" subtitle="People with full access to every college and every account on SelectIQ." />

      <Panel eyebrow="Grant" title="Add a Super Admin">
        <GrantSuperAdmin />
        <p className="text-muted-foreground mt-3 text-xs">
          The person must have signed in to SelectIQ once. College staff should be College Admins, not Super Admins.
        </p>
      </Panel>

      <section className="siq-card siq-rise overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-[15px] font-semibold">Super Admins · {admins.length}</h2>
          <p className="text-muted-foreground text-xs">To revoke, change their role. The last active Super Admin can’t be removed.</p>
        </div>
        <ul className="divide-y">
          {admins.map((a) => (
            <li key={a.id} className="siq-row flex items-center gap-3 px-5 py-3.5">
              <Initials name={a.name} email={a.email} />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/users/${a.id}`} className="hover:text-primary block truncate text-sm font-medium">
                  {a.name ?? a.email} {a.id === me.id ? <span className="bg-muted ml-1 rounded px-1.5 text-[10px] font-semibold">You</span> : null}
                </Link>
                <p className="text-muted-foreground truncate text-xs">
                  {a.email} · {a.suspendedAt ? 'suspended' : a.lastLoginAt ? `active ${timeAgo(a.lastLoginAt)}` : 'never signed in'}
                </p>
              </div>
              <RoleSelect userId={a.id} role="SUPER_ADMIN" self={a.id === me.id} />
            </li>
          ))}
        </ul>
      </section>

      <Panel eyebrow="History" title="Recent role changes">
        {grants.length === 0 ? (
          <p className="text-muted-foreground text-sm">None recorded.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {grants.map((g) => {
              const m = (g.metadata ?? {}) as { from?: string; to?: string }
              return (
                <li key={g.id} className="flex flex-wrap items-center gap-x-2">
                  <span className="font-medium">{g.user.name ?? g.user.email}</span>
                  <span className="text-muted-foreground">
                    {g.action === 'superadmin.grant' ? 'granted Super Admin' : `changed a role${m.to ? ` → ${m.to.replace('_', ' ').toLowerCase()}` : ''}`}
                  </span>
                  {g.entityId ? (
                    <Link href={`/admin/users/${g.entityId}`} className="text-primary text-xs hover:underline">
                      view person
                    </Link>
                  ) : null}
                  <span className="text-muted-foreground ml-auto text-xs">{timeAgo(g.createdAt)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}

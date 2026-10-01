import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AtSign, Globe, Info, Link2 } from 'lucide-react'

import { AccessMatrix } from '@/components/people/access-matrix'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Settings — College admin — SelectIQ' }

/**
 * College settings. The fields that control access across tenants — the
 * URL slug and the student email domain (auto-join) — are Super Admin only,
 * so here they're read-only with a clear reason.
 */
export default async function ManageSettingsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true, domain: true, type: true, createdAt: true, studentsPickDepartment: true },
  })
  if (!org) notFound()

  const rows = [
    { icon: Info, label: 'College name', value: org.name },
    { icon: Link2, label: 'Workspace address', value: `selectiq…/${org.slug}` },
    {
      icon: AtSign,
      label: 'Student email domain',
      value: org.domain ? `@${org.domain}` : 'Not set',
      note: org.domain
        ? `Students who sign in with a verified @${org.domain} address join ${org.name} automatically.`
        : 'Without a domain, students join only when you import them.',
    },
    {
      icon: Globe,
      label: 'Student departments',
      value: org.studentsPickDepartment ? 'Students choose at registration' : 'Assigned by the college',
      note: 'Change this under Departments.',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <section className="siq-card siq-rise overflow-hidden">
        <div className="border-b px-5 py-4">
          <h2 className="text-[15px] font-semibold">College profile</h2>
          <p className="text-muted-foreground text-xs">
            {user.role === 'SUPER_ADMIN'
              ? 'Edit these in the Platform console → Organizations.'
              : 'Name, address and email domain are managed by SelectIQ so no college can claim another’s students. Contact SelectIQ support to change them.'}
          </p>
        </div>
        <dl className="divide-y">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-start sm:gap-6">
              <dt className="text-muted-foreground flex w-56 shrink-0 items-center gap-2 text-sm">
                <r.icon className="size-4" aria-hidden />
                {r.label}
              </dt>
              <dd className="min-w-0 flex-1 text-sm">
                <p className="font-medium">{r.value}</p>
                {r.note ? <p className="text-muted-foreground mt-0.5 text-xs">{r.note}</p> : null}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <AccessMatrix highlight={user.role === 'SUPER_ADMIN' ? 'sa' : 'ca'} />
    </div>
  )
}

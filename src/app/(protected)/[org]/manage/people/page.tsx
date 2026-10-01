import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, GraduationCap } from 'lucide-react'

import { AccessMatrix } from '@/components/people/access-matrix'
import { StaffManager } from '@/components/people/staff-manager'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { getOrgBySlug } from '@/services/organizations'
import { listCollegeStaff } from '@/services/people'

export const metadata: Metadata = { title: 'People — College admin — SelectIQ' }

export default async function ManagePeoplePage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const [staff, departments, students] = await Promise.all([
    listCollegeStaff(org.id),
    prisma.department.findMany({ where: { orgId: org.id }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
    prisma.organizationMember.count({ where: { orgId: org.id, user: { role: 'STUDENT' } } }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <StaffManager
        orgId={org.id}
        actorId={user.id}
        departments={departments}
        staff={staff.map((s) => ({ ...s, lastLoginAt: s.lastLoginAt?.toISOString() ?? null }))}
      />

      <Link href={`/${slug}/candidates`} className="siq-card siq-lift group flex items-center gap-4 p-5">
        <span className="bg-accent text-primary grid size-10 place-items-center rounded-xl">
          <GraduationCap className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Students · {students.toLocaleString('en-IN')}</span>
          <span className="text-muted-foreground block text-xs">Import, edit, move between departments, set up password sign-in or remove — on Candidates.</span>
        </span>
        <ArrowRight className="text-muted-foreground group-hover:text-primary size-4 transition-colors" aria-hidden />
      </Link>

      <AccessMatrix highlight={user.role === 'SUPER_ADMIN' ? 'sa' : 'ca'} />
    </div>
  )
}

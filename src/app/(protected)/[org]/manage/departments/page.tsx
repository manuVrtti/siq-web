import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Users } from 'lucide-react'

import { DepartmentsManager } from '@/components/settings/departments-manager'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { listDepartments } from '@/services/departments'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Departments — College admin — SelectIQ' }

/**
 * College Admin panel → Departments: who sets a student's department, the
 * departments, and the HOD(s) of each. College Admin / Super Admin only
 * (MANAGE_OWN_ORG + the manage layout).
 */
export default async function ManageDepartmentsPage({ params }: { params: Promise<{ org: string }> }) {
  await requirePagePermission(PERMISSIONS.MANAGE_OWN_ORG)
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const data = await listDepartments(org.id)

  return (
    <div className="flex flex-col gap-6">
      {data.unassigned > 0 && data.departments.length > 0 ? (
        <Link
          href={`/${slug}/candidates?dept=none`}
          className="siq-card siq-lift border-warning/40 bg-warning/5 flex items-center gap-3 p-4 text-sm"
        >
          <span className="bg-warning/15 text-warning grid size-9 place-items-center rounded-xl">
            <Users className="size-4" aria-hidden />
          </span>
          <span className="flex-1">
            <b>{data.unassigned.toLocaleString('en-IN')} students aren&apos;t in a department yet.</b>{' '}
            <span className="text-muted-foreground">Only College Admins can see them. Select them on Candidates and use “Move to…”.</span>
          </span>
          <ArrowRight className="text-muted-foreground size-4" aria-hidden />
        </Link>
      ) : null}

      <DepartmentsManager
        orgId={org.id}
        studentsPickDepartment={data.studentsPickDepartment}
        departments={data.departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          students: d._count.members,
          assessments: d._count.assessments,
          batches: d._count.batches,
          heads: d.heads.map((h) => ({
            id: h.user.id,
            name: h.user.name,
            email: h.user.email,
            pending: h.user.firebaseUid.startsWith('pending:'),
          })),
        }))}
      />
    </div>
  )
}

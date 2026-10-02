import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DriveForm } from '@/components/mock-drives/drive-form'
import PageHeader from '@/components/ui/page-header'
import { requireDrivePage } from '@/lib/auth/drive-page'
import { listScopeDepartments } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { canManageDrive, getDrive } from '@/services/mock-drives'

export const metadata: Metadata = { title: 'Edit mock drive — SelectIQ' }

/** datetime-local value in IST (the app's display zone). */
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : '')

export default async function EditDrivePage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params
  const { org, scope } = await requireDrivePage(slug)
  const drive = await getDrive(scope, id).catch(() => null)
  if (!drive || !canManageDrive(scope, drive)) notFound()

  const [departments, companies] = await Promise.all([
    listScopeDepartments(scope),
    prisma.organization.findMany({ where: { type: 'COMPANY', status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <>
      <PageHeader title="Edit mock drive" description={drive.title} />
      <DriveForm
        orgId={org.id}
        slug={slug}
        departments={departments}
        companies={companies}
        collegeWideAllowed={scope.all}
        initial={{
          id: drive.id,
          mode: drive.mode,
          title: drive.title,
          description: drive.description ?? '',
          employerName: drive.employerName,
          employerLogo: drive.employerLogo ?? '',
          roleTitle: drive.roleTitle,
          roleCtc: drive.roleCtc ?? '',
          sampleCompanyOrgId: drive.sampleCompanyOrgId ?? '',
          departmentIds: drive.targets.map((t) => t.departmentId),
          batchYears: drive.batchYears,
          minCgpa: drive.minCgpa === null ? '' : String(drive.minCgpa),
          startDate: local(drive.startDate),
          endDate: local(drive.endDate),
          registrationDeadline: local(drive.registrationDeadline),
        }}
      />
    </>
  )
}

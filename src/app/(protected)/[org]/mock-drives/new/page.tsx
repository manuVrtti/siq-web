import type { Metadata } from 'next'

import { DriveForm } from '@/components/mock-drives/drive-form'
import PageHeader from '@/components/ui/page-header'
import { requireDrivePage } from '@/lib/auth/drive-page'
import { listScopeDepartments } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'New mock drive — SelectIQ' }

export default async function NewDrivePage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, scope } = await requireDrivePage(slug)

  const [departments, companies] = await Promise.all([
    listScopeDepartments(scope),
    prisma.organization.findMany({ where: { type: 'COMPANY', status: 'ACTIVE' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])

  return (
    <>
      <PageHeader title="New mock drive" description={scope.all ? org.name : `${org.name} · for your department${departments.length === 1 ? '' : 's'}`} />
      <DriveForm orgId={org.id} slug={slug} departments={departments} companies={companies} collegeWideAllowed={scope.all} />
    </>
  )
}

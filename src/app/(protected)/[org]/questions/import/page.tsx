import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ListHeader } from '@/components/data/list-header'
import { ImportWizard } from '@/components/import/import-wizard'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Import questions — SelectIQ' }

/** Plan 020 — bulk question import from Excel / CSV. */
export default async function ImportQuestionsPage({ params }: { params: Promise<{ org: string }> }) {
  await requirePagePermission(PERMISSIONS.CREATE_ASSESSMENT)
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()
  const base = `/${slug}/questions`

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ListHeader
        eyebrow={
          <Link href={base} className="hover:text-foreground">
            Question bank
          </Link>
        }
        title="Import questions"
        description="Add many questions at once from a spreadsheet. Every row is checked with the same rules as the question form."
      />
      <ImportWizard
        kind="question"
        templateHref="/api/import/questions/template"
        validateUrl="/api/import/questions/validate"
        commitUrl="/api/import/questions/commit"
        describeRow="question"
        describeSummary="question"
        describeDone="question"
        doneHref={base}
      />
    </div>
  )
}

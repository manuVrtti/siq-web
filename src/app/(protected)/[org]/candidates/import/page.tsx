import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronDown } from 'lucide-react'

import CandidateImport from '@/components/candidates/candidate-import'
import { ListHeader } from '@/components/data/list-header'
import { ImportWizard } from '@/components/import/import-wizard'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Import candidates — SelectIQ' }

/**
 * Plan 020 — roster import from Excel / CSV (name, email, phone, batch).
 * The plan-013 paste box stays below as a quick path for a handful of
 * addresses.
 */
export default async function ImportCandidatesPage({ params }: { params: Promise<{ org: string }> }) {
  await requirePagePermission(PERMISSIONS.MANAGE_ORG_USERS)
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()
  const base = `/${slug}/candidates`

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <ListHeader
        eyebrow={
          <Link href={base} className="hover:text-foreground">
            Candidates
          </Link>
        }
        title="Import candidates"
        description="Upload your roster. Candidates claim their account by signing in with the same email or phone; existing accounts are linked, never duplicated."
      />
      <ImportWizard
        kind="candidate"
        templateHref="/api/import/candidates/template"
        validateUrl="/api/import/candidates/validate"
        commitUrl="/api/import/candidates/commit"
        describeRow="candidate"
        describeSummary="candidate"
        describeDone="candidate"
        doneHref={base}
      />

      <details className="siq-card group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Just a few people? Paste a list instead</p>
            <p className="text-muted-foreground text-xs">
              Emails or phone numbers, one per line or comma-separated.
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
    </div>
  )
}

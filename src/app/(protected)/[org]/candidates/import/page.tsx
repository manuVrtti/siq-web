import type { Metadata } from 'next'
import Link from 'next/link'

import { ListHeader } from '@/components/data/list-header'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePageScope } from '@/lib/auth/page-guard'
import { listScopeDepartments } from '@/lib/auth/scope'
import { CandidateImportPanel } from '@/components/candidates/candidate-import-panel'

export const metadata: Metadata = { title: 'Import candidates — SelectIQ' }

/**
 * Plan 020 — roster import from Excel / CSV (name, email, phone, batch).
 * The plan-013 paste box stays below as a quick path for a handful of
 * addresses.
 */
export default async function ImportCandidatesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { scope } = await requirePageScope(PERMISSIONS.MANAGE_ORG_USERS, slug)
  const departments = await listScopeDepartments(scope)
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
      <CandidateImportPanel departments={departments} required={!scope.all} base={base} />
    </div>
  )
}

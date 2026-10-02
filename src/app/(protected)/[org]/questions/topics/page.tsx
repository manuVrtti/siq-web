import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { TaxonomyManager } from '@/components/questions/taxonomy-manager'
import PageHeader from '@/components/ui/page-header'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { getOrgBySlug } from '@/services/organizations'
import { listTaxonomy } from '@/services/taxonomy'

export const metadata: Metadata = { title: 'Topics & skills — SelectIQ' }

/**
 * Plan 021 — the topics + skills questions in this college are tagged with.
 * Everyone who writes questions can see it; only College Admins (and Super
 * Admins) add or remove the college's own entries.
 */
export default async function TopicsPage({ params }: { params: Promise<{ org: string }> }) {
  const user = await requirePagePermission(PERMISSIONS.EDIT_ASSESSMENT)
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const topics = await listTaxonomy(org.id)
  const canEdit = user.role === 'COLLEGE_ADMIN' || user.role === 'SUPER_ADMIN'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col">
      <Link href={`/${slug}/questions`} className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Question bank
      </Link>
      <PageHeader
        title="Topics & skills"
        description={
          canEdit
            ? 'What questions measure. Every question gets one topic and at least one skill — that’s how students see strengths & weaknesses.'
            : 'What questions measure. Ask a College Admin to add a topic or skill that’s missing.'
        }
      />
      <TaxonomyManager
        scopeOrgId={org.id}
        canEdit={canEdit}
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          description: t.description,
          questions: t.questions,
          editable: t.orgId === org.id,
          platform: t.platform,
          skills: t.skills.map((s) => ({
            id: s.id,
            name: s.name,
            aliases: s.aliases,
            questions: s.questions,
            editable: s.orgId === org.id,
          })),
        }))}
      />
    </div>
  )
}

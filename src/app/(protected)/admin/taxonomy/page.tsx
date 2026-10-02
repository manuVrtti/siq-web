import type { Metadata } from 'next'

import { TaxonomyManager } from '@/components/questions/taxonomy-manager'
import PageHeader from '@/components/ui/page-header'
import { listPlatformTaxonomy } from '@/services/taxonomy'

export const metadata: Metadata = { title: 'Topics & skills — SelectIQ console' }
export const dynamic = 'force-dynamic'

/**
 * Plan 021 — the platform taxonomy spine every college shares. admin/layout
 * gates SUPER_ADMIN; the API re-checks on every write.
 */
export default async function PlatformTaxonomyPage() {
  const topics = await listPlatformTaxonomy()
  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader
        title="Topics & skills"
        description="The shared spine questions are tagged with. Colleges add their own on top; they can’t change these."
      />
      <TaxonomyManager
        scopeOrgId={null}
        canEdit
        topics={topics.map((t) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          description: t.description,
          questions: t._count.questions,
          editable: true,
          platform: true,
          skills: t.skills.map((s) => ({ id: s.id, name: s.name, aliases: s.aliases, questions: s._count.questions, editable: true })),
        }))}
      />
    </div>
  )
}

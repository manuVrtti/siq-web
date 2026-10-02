import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { TaggingQueue } from '@/components/questions/tagging-queue'
import PageHeader from '@/components/ui/page-header'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePagePermission } from '@/lib/auth/page-guard'
import { prisma } from '@/lib/prisma'
import { getOrgBySlug } from '@/services/organizations'
import { listTaxonomy, untaggedWhere } from '@/services/taxonomy'

export const metadata: Metadata = { title: 'Tag questions — SelectIQ' }

/**
 * Plan 021 — the backfill queue: questions without a topic or skill (bulk
 * imports, questions made before the taxonomy). Select several, pick a topic
 * + skills once, apply.
 */
export default async function TaggingPage({ params }: { params: Promise<{ org: string }> }) {
  await requirePagePermission(PERMISSIONS.EDIT_ASSESSMENT)
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const where = { orgId: org.id, AND: [untaggedWhere] }
  const [questions, total, topics] = await Promise.all([
    prisma.question.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 200,
      select: {
        id: true,
        title: true,
        type: true,
        difficulty: true,
        tags: { select: { tag: { select: { name: true } } } },
        _count: { select: { assessmentQuestions: true } },
      },
    }),
    prisma.question.count({ where }),
    listTaxonomy(org.id),
  ])

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col">
      <Link href={`/${slug}/questions`} className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Question bank
      </Link>
      <PageHeader
        title="Tag questions"
        description={
          total === 0
            ? 'Every question has a topic and skill. Nice.'
            : `${total.toLocaleString('en-IN')} question${total === 1 ? '' : 's'} need a topic and skill${total > 200 ? ' — showing the newest 200' : ''}.`
        }
      />
      <TaggingQueue
        orgId={org.id}
        topics={topics}
        questions={questions.map((q) => ({
          id: q.id,
          title: q.title,
          type: q.type,
          difficulty: q.difficulty,
          tags: q.tags.map((t) => t.tag.name),
          usedIn: q._count.assessmentQuestions,
        }))}
      />
    </div>
  )
}

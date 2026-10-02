import 'server-only'

import { prisma } from '@/lib/prisma'
import { computeBaselines } from '@/services/competency/cohort-baseline'
import { generateInsights } from '@/services/competency/insights'

/**
 * Plan 026 — refresh a college's cohort comparisons: rebuild baselines, then
 * re-classify every student against them (below-batch flags and priorities
 * depend on the baselines). Run nightly by /api/cron/analytics and after a
 * College Admin's full rebuild.
 */
export async function refreshOrgInsights(orgId: string) {
  const baselines = await computeBaselines(orgId)
  const students = await prisma.sectionCompetency.findMany({
    where: { orgId, scope: 'CUMULATIVE' },
    select: { userId: true },
    distinct: ['userId'],
  })
  for (const { userId } of students) await generateInsights(userId, orgId)
  return { baselines: baselines.rows, students: students.length }
}

/** Every active college that has any profile. Stops early near the time budget. */
export async function refreshAllColleges(budgetMs = 50_000) {
  const started = Date.now()
  const orgs = await prisma.organization.findMany({
    where: { status: 'ACTIVE', sectionCompetencies: { some: { scope: 'CUMULATIVE' } } },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  const done: string[] = []
  for (const o of orgs) {
    if (Date.now() - started > budgetMs) break
    await refreshOrgInsights(o.id)
    done.push(o.id)
  }
  return { colleges: orgs.length, refreshed: done.length }
}

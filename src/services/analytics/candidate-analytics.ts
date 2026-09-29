import 'server-only'

import { cache } from 'react'

import { NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { mean, round } from '@/services/analytics/stats'

/**
 * Plan 019 — candidate + batch analytics.
 *
 * The student dashboard is org-scoped like everything else under /[org]: a
 * student in two colleges sees each college's exams in that college's
 * workspace. Their cross-org history lives at /my-results.
 */

/** Everything the student dashboard needs, in one parallel batch. */
export const getStudentOverview = cache(async (orgId: string, userId: string) => {
  const now = new Date()
  const [assignments, results] = await Promise.all([
    prisma.assessmentAssignment.findMany({
      where: { userId, assessment: { orgId, status: 'PUBLISHED' } },
      orderBy: { invitedAt: 'desc' },
      select: {
        id: true,
        token: true,
        status: true,
        invitedAt: true,
        submittedAt: true,
        assessment: {
          select: { id: true, title: true, durationMinutes: true, startAt: true, endAt: true },
        },
      },
    }),
    prisma.result.findMany({
      where: { userId, assessment: { orgId } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        status: true,
        percentage: true,
        passed: true,
        createdAt: true,
        assessment: { select: { title: true } },
      },
    }),
  ])

  // An exam is "open" if the candidate can still act on it: not submitted,
  // and its window hasn't closed.
  const open = assignments.filter(
    (a) =>
      (a.status === 'INVITED' || a.status === 'STARTED') &&
      (!a.assessment.endAt || a.assessment.endAt > now),
  )
  const graded = results.filter((r) => r.status === 'GRADED')
  const decided = graded.filter((r) => r.passed !== null)

  return {
    open,
    completed: assignments.filter((a) => a.status === 'SUBMITTED').length,
    pendingReview: results.filter((r) => r.status === 'PENDING_REVIEW').length,
    avgPercentage: round(mean(graded.map((r) => r.percentage))),
    bestPercentage: graded.length ? round(Math.max(...graded.map((r) => r.percentage))) : null,
    passed: decided.filter((r) => r.passed).length,
    decided: decided.length,
    trend: graded.map((r) => ({
      id: r.id,
      title: r.assessment.title,
      percentage: round(r.percentage) ?? 0,
      at: r.createdAt,
    })),
    recent: [...results].reverse().slice(0, 5),
  }
})

/** Aggregate graded performance of a batch's members on this org's exams. */
export async function getBatchPerformance(orgId: string, batchId: string) {
  const batch = await prisma.batch.findFirst({
    where: { id: batchId, orgId },
    select: {
      id: true,
      name: true,
      members: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
  })
  if (!batch) throw new NotFoundError('Batch not found')

  const userIds = batch.members.map((m) => m.user.id)
  const results = userIds.length
    ? await prisma.result.findMany({
        where: { userId: { in: userIds }, status: 'GRADED', assessment: { orgId } },
        select: { userId: true, percentage: true, passed: true },
      })
    : []

  const byUser = new Map<string, number[]>()
  for (const r of results) {
    const list = byUser.get(r.userId) ?? []
    list.push(r.percentage)
    byUser.set(r.userId, list)
  }
  const decided = results.filter((r) => r.passed !== null)

  return {
    id: batch.id,
    name: batch.name,
    members: batch.members.length,
    graded: results.length,
    avgPercentage: round(mean(results.map((r) => r.percentage))),
    passRate: decided.length
      ? round((decided.filter((r) => r.passed).length / decided.length) * 100)
      : null,
    perMember: batch.members
      .map((m) => ({
        ...m.user,
        attempts: byUser.get(m.user.id)?.length ?? 0,
        avgPercentage: round(mean(byUser.get(m.user.id) ?? [])),
      }))
      .sort((a, b) => (b.avgPercentage ?? -1) - (a.avgPercentage ?? -1)),
  }
}

/** Summary rows for every batch in the org — the analytics page table. */
export async function listBatchPerformance(orgId: string) {
  const batches = await prisma.batch.findMany({
    where: { orgId },
    orderBy: { name: 'asc' },
    select: { id: true },
  })
  return Promise.all(batches.map((b) => getBatchPerformance(orgId, b.id)))
}

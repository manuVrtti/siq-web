import 'server-only'

import { shortDateTime } from '@/lib/format'
import { prisma } from '@/lib/prisma'

import { notify } from './dispatch'

/**
 * Domain event → personal notification. Called by services AFTER their write
 * commits; each one is idempotent (dedupe key) and never throws.
 */

/** Students newly assigned a published test. Drafts notify on publish. */
export async function notifyAssigned(assessmentId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return
  const a = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    select: { id: true, title: true, status: true, startAt: true, endAt: true, orgId: true, org: { select: { slug: true } } },
  })
  if (!a || a.status !== 'PUBLISHED') return

  const when = a.startAt && a.startAt > new Date()
    ? `Opens ${shortDateTime(a.startAt)}`
    : a.endAt
      ? `Open now · closes ${shortDateTime(a.endAt)}`
      : 'Open now'

  await notify(
    userIds.map((userId) => ({
      eventType: 'assessment.assigned' as const,
      recipientUserId: userId,
      orgId: a.orgId,
      primaryEntityId: a.id,
      title: `New test assigned: ${a.title}`,
      body: when,
      href: `/${a.org.slug}/my-assessments`,
    })),
  )
}

/** On publish: everyone already assigned while it was a draft. */
export async function notifyAssignedOnPublish(assessmentId: string): Promise<void> {
  const rows = await prisma.assessmentAssignment.findMany({
    where: { assessmentId, status: { in: ['INVITED', 'STARTED'] } },
    select: { userId: true },
  })
  await notifyAssigned(assessmentId, rows.map((r) => r.userId))
}

/** A result that is now fully graded. */
export async function notifyResultGraded(resultId: string): Promise<void> {
  const r = await prisma.result.findUnique({
    where: { id: resultId },
    select: {
      id: true,
      userId: true,
      status: true,
      percentage: true,
      assessment: { select: { title: true, orgId: true } },
    },
  })
  if (!r || r.status !== 'GRADED') return
  await notify([
    {
      eventType: 'result.graded',
      recipientUserId: r.userId,
      orgId: r.assessment.orgId,
      primaryEntityId: r.id,
      title: `Result ready: ${r.assessment.title}`,
      body: `You scored ${Math.round(r.percentage)}%`,
      href: `/my-results/${r.id}`,
    },
  ])
}

/** Wrapper for hooks: a notification failure never fails the caller. */
export async function safely(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    console.error('[notify] event hook failed', String(error))
  }
}

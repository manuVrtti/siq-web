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

/** Plan 024 — a mock drive round outcome (or the final shortlist when roundName is null). */
export async function notifyDriveOutcome(e: {
  userId: string
  driveId: string
  orgId: string
  driveTitle: string
  roundName: string | null
  outcome: 'PENDING' | 'SHORTLISTED' | 'ELIMINATED'
  key: string
}): Promise<void> {
  if (e.outcome === 'PENDING') return
  const org = await prisma.organization.findUnique({ where: { id: e.orgId }, select: { slug: true } })
  if (!org) return
  const title =
    e.roundName === null
      ? `Final shortlist: ${e.driveTitle} 🎉`
      : e.outcome === 'SHORTLISTED'
        ? `Cleared ${e.roundName} · ${e.driveTitle}`
        : `Not shortlisted after ${e.roundName} · ${e.driveTitle}`
  await notify([
    {
      eventType: 'drive.outcome' as const,
      recipientUserId: e.userId,
      orgId: e.orgId,
      primaryEntityId: e.driveId,
      title,
      body: e.outcome === 'ELIMINATED' ? 'See what to work on before the next drive.' : null,
      href: `/${org.slug}/my-drives/${e.driveId}`,
      dedupeKey: `drive.outcome:${e.userId}:${e.key}`,
    },
  ])
}

/** Plan 016b — staff allowed a fresh attempt. */
export async function notifyRetakeGranted(e: { userId: string; assessmentId: string; title: string; key: string }): Promise<void> {
  const a = await prisma.assessment.findUnique({ where: { id: e.assessmentId }, select: { orgId: true, org: { select: { slug: true } } } })
  if (!a) return
  await notify([
    {
      eventType: 'assessment.retake' as const,
      recipientUserId: e.userId,
      orgId: a.orgId,
      primaryEntityId: e.assessmentId,
      title: `Retake allowed: ${e.title}`,
      body: 'Your college gave you a fresh attempt. Your earlier attempt no longer counts.',
      href: `/${a.org.slug}/my-assessments`,
      dedupeKey: `assessment.retake:${e.userId}:${e.key}`,
    },
  ])
}

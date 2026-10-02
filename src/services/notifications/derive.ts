import 'server-only'

import { getScope, resultWhere } from '@/lib/auth/scope'
import { shortDateTime } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

import type { AppNotification } from './types'

/**
 * Automated notifications derived at read time from live data — never stored,
 * no cron (ABTalks plan 067 §3a). Keys are stable so read state survives:
 *
 *   STUDENT  → "open:<assignmentId>"  a test open to take right now
 *   managers → "review:<assessmentId>:<newest ms>"  answers awaiting manual
 *              review, in the caller's Scope; a new submission changes the
 *              key, so the item lights up again.
 */

type Org = { id: string; slug: string }
type Derived = Omit<AppNotification, 'isRead'> & {
  /** Server-only: lets the feed drop an "is open" item the assigned notice already covers. */
  assessmentId?: string
}

const LIMIT = 20

export async function deriveNotifications(user: CurrentUser, org: Org): Promise<Derived[]> {
  return user.role === 'STUDENT' ? openTests(user.id, org) : pendingReviews(user, org)
}

async function openTests(userId: string, org: Org): Promise<Derived[]> {
  const now = new Date()
  const open = await prisma.assessmentAssignment.findMany({
    where: {
      userId,
      status: { in: ['INVITED', 'STARTED'] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      assessment: {
        orgId: org.id,
        status: 'PUBLISHED',
        AND: [
          { OR: [{ startAt: null }, { startAt: { lte: now } }] },
          { OR: [{ endAt: null }, { endAt: { gt: now } }] },
        ],
      },
    },
    orderBy: { invitedAt: 'desc' },
    take: LIMIT,
    select: {
      id: true,
      status: true,
      invitedAt: true,
      assessmentId: true,
      assessment: { select: { title: true, startAt: true, endAt: true } },
    },
  })

  return open.map((a) => {
    const startAt = a.assessment.startAt
    return {
      key: `open:${a.id}`,
      title: a.status === 'STARTED' ? `Finish ${a.assessment.title}` : `${a.assessment.title} is open`,
      body: a.assessment.endAt ? `Closes ${shortDateTime(a.assessment.endAt)}` : 'You can take it now',
      href: `/${org.slug}/my-assessments`,
      category: 'ASSESSMENT' as const,
      // It became actionable when the window opened (or when invited).
      publishedAt: (startAt && startAt > a.invitedAt ? startAt : a.invitedAt).toISOString(),
      assessmentId: a.assessmentId,
    }
  })
}

async function pendingReviews(user: CurrentUser, org: Org): Promise<Derived[]> {
  const scope = await getScope(user, org.id)
  const pending = await prisma.result.groupBy({
    by: ['assessmentId'],
    where: { ...resultWhere(scope), status: 'PENDING_REVIEW' },
    _count: { _all: true },
    _max: { createdAt: true },
  })
  if (pending.length === 0) return []

  const titles = new Map(
    (
      await prisma.assessment.findMany({
        where: { id: { in: pending.map((p) => p.assessmentId) }, orgId: org.id },
        select: { id: true, title: true },
      })
    ).map((a) => [a.id, a.title]),
  )

  return pending.map((p) => {
    const n = p._count._all
    const newest = p._max.createdAt ?? new Date(0)
    return {
      key: `review:${p.assessmentId}:${newest.getTime()}`,
      title: `${n} ${n === 1 ? 'submission needs' : 'submissions need'} review`,
      body: titles.get(p.assessmentId) ?? 'Assessment',
      href: `/${org.slug}/results`,
      category: 'REVIEW' as const,
      publishedAt: newest.toISOString(),
    }
  })
}

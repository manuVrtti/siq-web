import 'server-only'

import type { NotificationAudience } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import type { CurrentUser } from '@/types/auth'

import { deriveNotifications } from './derive'
import { ANNOUNCEMENT_KEY_PREFIX, PERSONAL_KEY_PREFIX, type AppNotification, type NotificationFeed } from './types'

/**
 * One merged feed for one workspace (ABTalks plan 067 get-notifications):
 *   - broadcast announcements (Notification rows), audience + department filtered
 *   - automated items derived from live data (derive.ts)
 *   - personal items (UserNotification rows)
 * Read state is joined from NotificationRead by string key. Pure read path.
 */

/** The bell shows this many; the Notifications page shows more. */
export const BELL_LIMIT = 10
/** Announcements also age out, so deactivating new ones never resurfaces stale ones unread. */
const ANNOUNCEMENT_MAX_AGE_DAYS = 14
const SCAN_LIMIT = 50

type Org = { id: string; slug: string }

export async function getFeed(user: CurrentUser, org: Org, limit = BELL_LIMIT): Promise<NotificationFeed> {
  const now = new Date()
  const cutoff = new Date(now.getTime() - ANNOUNCEMENT_MAX_AGE_DAYS * 86_400_000)
  const audiences: NotificationAudience[] = user.role === 'STUDENT' ? ['ALL', 'STUDENTS'] : ['ALL', 'STAFF']

  const [deptIds, derived, personal] = await Promise.all([
    myDepartmentIds(user.id, org.id),
    deriveNotifications(user, org),
    prisma.userNotification.findMany({
      where: { recipientUserId: user.id, OR: [{ orgId: org.id }, { orgId: null }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true, body: true, href: true, eventType: true, primaryEntityId: true, createdAt: true },
    }),
  ])

  const announcements = await prisma.notification.findMany({
    where: {
      isActive: true,
      publishedAt: { lte: now, gte: cutoff },
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ orgId: org.id }, { orgId: null }] },
        {
          OR: [
            { departmentId: null, audience: { in: audiences } },
            { departmentId: { in: deptIds }, audience: { in: audiences } },
            // Authors always see their own, whatever it targets.
            { createdById: user.id },
          ],
        },
      ],
    },
    orderBy: { publishedAt: 'desc' },
    take: SCAN_LIMIT,
    select: { id: true, title: true, body: true, href: true, category: true, publishedAt: true },
  })

  // "New test assigned" sent once the test was already open says the same
  // thing as the derived "is open" item — keep one. If the window opened
  // after the notice, the "is open" item stays as the reminder.
  const assignedAt = new Map(
    personal.filter((p) => p.eventType === 'assessment.assigned' && p.primaryEntityId).map((p) => [p.primaryEntityId!, p.createdAt.toISOString()]),
  )
  const derivedItems = derived
    .filter((d) => !(d.assessmentId && (assignedAt.get(d.assessmentId) ?? '') >= d.publishedAt))
    .map((d) => ({ key: d.key, title: d.title, body: d.body, href: d.href, category: d.category, publishedAt: d.publishedAt }))

  const merged: Omit<AppNotification, 'isRead'>[] = [
    ...announcements.map((a) => ({
      key: `${ANNOUNCEMENT_KEY_PREFIX}${a.id}`,
      title: a.title,
      body: a.body,
      href: a.href,
      category: a.category,
      publishedAt: a.publishedAt.toISOString(),
    })),
    ...derivedItems,
    ...personal.map((p) => ({
      key: `${PERSONAL_KEY_PREFIX}${p.id}`,
      title: p.title,
      body: p.body,
      href: p.href,
      category: p.eventType === 'result.graded' ? ('RESULT' as const) : ('ASSESSMENT' as const),
      publishedAt: p.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)

  const read = await prisma.notificationRead.findMany({
    where: { userId: user.id, notificationKey: { in: merged.map((m) => m.key) } },
    select: { notificationKey: true },
  })
  const readKeys = new Set(read.map((r) => r.notificationKey))

  const items = merged.map((m) => ({ ...m, isRead: readKeys.has(m.key) }))
  return { items, unreadCount: items.filter((i) => !i.isRead).length }
}

/** Departments the user belongs to (student) or heads (HOD) in this org. */
async function myDepartmentIds(userId: string, orgId: string): Promise<string[]> {
  const [member, heads] = await Promise.all([
    prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
      select: { departmentId: true },
    }),
    prisma.departmentHead.findMany({ where: { userId, department: { orgId } }, select: { departmentId: true } }),
  ])
  return [...new Set([member?.departmentId, ...heads.map((h) => h.departmentId)].filter((d): d is string => !!d))]
}

/**
 * Mark keys read for this user. Keys are opaque (derived items have no row),
 * so a caller can only ever write read-marks for themselves — harmless.
 */
export async function markRead(userId: string, keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await prisma.notificationRead.createMany({
    data: keys.map((notificationKey) => ({ userId, notificationKey })),
    skipDuplicates: true,
  })
}

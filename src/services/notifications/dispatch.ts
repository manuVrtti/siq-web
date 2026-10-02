import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { isValidEventType, type EventType } from './event-types'

/**
 * notify() — personal in-app notifications (ABTalks `dispatch`, made
 * batch-friendly: assigning a test to a 600-student batch is one insert).
 *
 * One UserNotification per recipient, de-duplicated by `dedupeKey`
 * (default "<eventType>:<recipient>:<entity>") — calling twice is safe.
 *
 * CALLER RULES: call AFTER your write commits, never inside a transaction.
 * notify() never throws — a notification failure must not fail grading or
 * assigning. Callers are responsible for authorisation; this does none.
 */

export type NotifyEvent = {
  eventType: EventType
  recipientUserId: string
  /** Workspace the item shows in (null = every workspace). */
  orgId: string | null
  primaryEntityId: string
  title: string
  body?: string | null
  href?: string | null
  metadata?: Prisma.InputJsonValue
  dedupeKey?: string
}

export async function notify(events: NotifyEvent[]): Promise<{ created: number }> {
  try {
    const valid = events.filter((e) => isValidEventType(e.eventType))
    if (valid.length === 0) return { created: 0 }

    const res = await prisma.userNotification.createMany({
      data: valid.map((e) => ({
        recipientUserId: e.recipientUserId,
        orgId: e.orgId,
        eventType: e.eventType,
        title: e.title.slice(0, 200),
        body: e.body?.slice(0, 500) ?? null,
        href: e.href ?? null,
        dedupeKey: e.dedupeKey ?? `${e.eventType}:${e.recipientUserId}:${e.primaryEntityId}`,
        primaryEntityId: e.primaryEntityId,
        metadata: e.metadata,
      })),
      skipDuplicates: true,
    })
    return { created: res.count }
  } catch (error) {
    console.error('[notify] failed', { count: events.length, error: String(error) })
    return { created: 0 }
  }
}

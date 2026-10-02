import 'server-only'

import type { NotificationAudience, NotificationCategory, Prisma } from '@prisma/client'
import { z } from 'zod'

import { resolveOwningDepartment, type Scope } from '@/lib/auth/scope'
import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { audit } from '@/services/audit'

/**
 * Broadcast announcements (ABTalks plan 067 admin composer), tenant-scoped.
 *
 *   College Admin / recruiter → their org, college-wide or one department
 *   HOD                       → one of their own departments only
 *   Super Admin (console)     → every college at once (orgId null)
 *
 * Reversible by design: announcements are deactivated, never deleted.
 * Every change is audited.
 */

const hrefSchema = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v.startsWith('/') || v.startsWith('https://'), 'Link must start with / or https://')

export const announcementInput = z.object({
  title: z.string().trim().min(1, 'Title is required').max(120),
  body: z.string().trim().max(500).optional(),
  href: z.union([hrefSchema, z.literal('')]).optional(),
  category: z.enum(['GENERAL', 'ASSESSMENT', 'RESULT', 'REVIEW', 'SYSTEM']).default('GENERAL'),
  audience: z.enum(['ALL', 'STUDENTS', 'STAFF']).default('ALL'),
  departmentId: z.string().min(1).nullable().optional(),
  /** ISO datetime, resolved in the author's browser. */
  expiresAt: z.string().datetime().optional(),
})
export type AnnouncementInput = z.infer<typeof announcementInput>

const announcementSelect = {
  id: true,
  title: true,
  body: true,
  href: true,
  category: true,
  audience: true,
  isActive: true,
  publishedAt: true,
  expiresAt: true,
  org: { select: { name: true } },
  department: { select: { code: true } },
  createdBy: { select: { name: true, email: true } },
} satisfies Prisma.NotificationSelect

export type AnnouncementRow = {
  id: string
  title: string
  body: string | null
  href: string | null
  category: NotificationCategory
  audience: NotificationAudience
  isActive: boolean
  publishedAt: string
  expiresAt: string | null
  /** Computed on the server so the client renders purely. */
  expired: boolean
  orgName: string | null
  departmentCode: string | null
  author: string | null
}

function toRow(n: Prisma.NotificationGetPayload<{ select: typeof announcementSelect }>): AnnouncementRow {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    href: n.href,
    category: n.category,
    audience: n.audience,
    isActive: n.isActive,
    publishedAt: n.publishedAt.toISOString(),
    expiresAt: n.expiresAt?.toISOString() ?? null,
    expired: n.expiresAt !== null && n.expiresAt <= new Date(),
    orgName: n.org?.name ?? null,
    departmentCode: n.department?.code ?? null,
    author: n.createdBy?.name ?? n.createdBy?.email ?? null,
  }
}

function parseInput(raw: unknown): AnnouncementInput {
  const r = announcementInput.safeParse(raw)
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? 'Invalid announcement')
  return r.data
}

function parseExpiry(input: AnnouncementInput): Date | null {
  if (!input.expiresAt) return null
  const d = new Date(input.expiresAt)
  if (d <= new Date()) throw new ValidationError('Expiry must be in the future')
  return d
}

/** What this scope may see and manage in its org. */
function scopeWhere(scope: Scope): Prisma.NotificationWhereInput {
  return scope.all
    ? { orgId: scope.orgId }
    : { orgId: scope.orgId, departmentId: { in: scope.departmentIds } }
}

export async function listAnnouncements(scope: Scope): Promise<AnnouncementRow[]> {
  const rows = await prisma.notification.findMany({
    where: scopeWhere(scope),
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: announcementSelect,
  })
  return rows.map(toRow)
}

export async function createAnnouncement(scope: Scope, authorId: string, raw: unknown): Promise<AnnouncementRow> {
  const input = parseInput(raw)
  // Admins may pick any department of the org or none; HODs must use theirs.
  const departmentId = await resolveOwningDepartment(scope, input.departmentId ?? null)
  const created = await prisma.notification.create({
    data: {
      orgId: scope.orgId,
      departmentId,
      title: input.title,
      body: input.body || null,
      href: input.href || null,
      category: input.category,
      audience: input.audience,
      expiresAt: parseExpiry(input),
      createdById: authorId,
    },
    select: announcementSelect,
  })
  await audit({
    userId: authorId,
    action: 'announcement.create',
    entityType: 'Notification',
    entityId: created.id,
    metadata: { orgId: scope.orgId, departmentId, audience: input.audience },
  })
  return toRow(created)
}

export async function setAnnouncementActive(scope: Scope, actorId: string, id: string, isActive: boolean): Promise<void> {
  const res = await prisma.notification.updateMany({ where: { id, ...scopeWhere(scope) }, data: { isActive } })
  if (res.count === 0) throw new NotFoundError('Announcement not found')
  await audit({
    userId: actorId,
    action: isActive ? 'announcement.reactivate' : 'announcement.deactivate',
    entityType: 'Notification',
    entityId: id,
  })
}

/* ---------------- Super Admin: platform-wide (orgId null) ---------------- */

export async function listPlatformAnnouncements(): Promise<AnnouncementRow[]> {
  const rows = await prisma.notification.findMany({
    where: { orgId: null },
    orderBy: { publishedAt: 'desc' },
    take: 100,
    select: announcementSelect,
  })
  return rows.map(toRow)
}

export async function createPlatformAnnouncement(authorId: string, raw: unknown): Promise<AnnouncementRow> {
  const input = parseInput(raw)
  if (input.departmentId) throw new ValidationError('Platform announcements cannot target a department')
  const created = await prisma.notification.create({
    data: {
      orgId: null,
      title: input.title,
      body: input.body || null,
      href: input.href || null,
      category: input.category,
      audience: input.audience,
      expiresAt: parseExpiry(input),
      createdById: authorId,
    },
    select: announcementSelect,
  })
  await audit({
    userId: authorId,
    action: 'announcement.create',
    entityType: 'Notification',
    entityId: created.id,
    metadata: { platformWide: true, audience: input.audience },
  })
  return toRow(created)
}

export async function setPlatformAnnouncementActive(actorId: string, id: string, isActive: boolean): Promise<void> {
  const res = await prisma.notification.updateMany({ where: { id, orgId: null }, data: { isActive } })
  if (res.count === 0) throw new NotFoundError('Announcement not found')
  await audit({
    userId: actorId,
    action: isActive ? 'announcement.reactivate' : 'announcement.deactivate',
    entityType: 'Notification',
    entityId: id,
  })
}

import 'server-only'

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/**
 * Audit trail (plan 048 overlap). Records who did what to which entity.
 *
 * `audit()` never throws into its caller: a failed audit write is logged and
 * swallowed, so an audit outage can't block grading an exam or importing a
 * roster. Metadata must never contain secrets or answer content — ids,
 * counts and before/after of the changed field only.
 */

export type AuditAction =
  | 'org.create'
  | 'org.update'
  | 'org.member.add'
  | 'org.member.remove'
  | 'user.role.change'
  | 'assessment.publish'
  | 'result.grade'
  | 'import.candidates'
  | 'import.questions'
  | 'batch.delete'
  | 'candidate.update'
  | 'candidate.remove'
  | 'candidate.credentials'
  | 'candidate.department'
  | 'department.create'
  | 'department.update'
  | 'department.delete'
  | 'department.heads'
  | 'staff.add'
  | 'staff.update'
  | 'staff.remove'
  | 'user.suspend'
  | 'user.reactivate'
  | 'superadmin.grant'
  | 'org.suspend'
  | 'org.reactivate'
  | 'announcement.create'
  | 'announcement.deactivate'
  | 'announcement.reactivate'
  | 'taxonomy.topic.create'
  | 'taxonomy.topic.update'
  | 'taxonomy.topic.delete'
  | 'taxonomy.skill.create'
  | 'taxonomy.skill.update'
  | 'taxonomy.skill.delete'
  | 'question.tag'
  | 'competency.recompute'
  | 'drive.create'
  | 'drive.update'
  | 'drive.delete'
  | 'drive.status'
  | 'drive.round'
  | 'drive.register'
  | 'drive.round.activate'
  | 'drive.round.evaluate'
  | 'drive.override'
  | 'drive.complete'

export async function audit(entry: {
  userId: string
  action: AuditAction
  entityType: string
  entityId?: string | null
  metadata?: Prisma.InputJsonValue
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata ?? undefined,
      },
    })
  } catch (error) {
    console.error('[audit] write failed', entry.action, (error as Error).message)
  }
}

export async function listAudit(opts: { action?: string; orgId?: string; skip?: number; take?: number }) {
  const where: Prisma.AuditLogWhereInput = {
    ...(opts.action && { action: opts.action }),
    // Entries about the org itself, or anything done inside it (metadata.orgId).
    ...(opts.orgId && { OR: [{ entityId: opts.orgId }, { metadata: { path: ['orgId'], equals: opts.orgId } }] }),
  }
  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 50, 200),
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
  ])
  return { items, total }
}

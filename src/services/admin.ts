import 'server-only'

import type { Prisma, UserRole } from '@prisma/client'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

/**
 * Platform admin console (SUPER_ADMIN only — callers enforce the role).
 * Cross-tenant by design: this is the one place that sees every org.
 */

export async function listOrganizations(opts: { q?: string; type?: 'COLLEGE' | 'COMPANY' }) {
  const where: Prisma.OrganizationWhereInput = {
    ...(opts.type && { type: opts.type }),
    ...(opts.q && {
      OR: [
        { name: { contains: opts.q, mode: 'insensitive' } },
        { slug: { contains: opts.q, mode: 'insensitive' } },
        { domain: { contains: opts.q, mode: 'insensitive' } },
      ],
    }),
  }
  return prisma.organization.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      domain: true,
      createdAt: true,
      _count: {
        select: {
          assessments: true,
          departments: true,
          members: { where: { user: { role: 'STUDENT' } } },
        },
      },
      members: { where: { user: { role: 'COLLEGE_ADMIN', suspendedAt: null } }, select: { userId: true } },
    },
  })
}

export async function getOrganizationDetail(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      domain: true,
      createdAt: true,
      _count: { select: { assessments: true, batches: true, questions: true } },
      members: {
        orderBy: { joinedAt: 'desc' },
        take: 500,
        select: {
          role: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true, role: true, lastLoginAt: true, firebaseUid: true } },
        },
      },
    },
  })
  if (!org) throw new NotFoundError('Organization not found')
  return org
}

/** Lowercase, bare host ("abes.ac.in"); rejects anything with a scheme/path. */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = raw.trim().toLowerCase().replace(/^@/, '')
  if (!d) return null
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) throw new ValidationError('Enter a bare email domain like abes.ac.in')
  return d
}

export async function updateOrganization(id: string, data: { name?: string; domain?: string | null }) {
  return prisma.organization.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.domain !== undefined && { domain: normalizeDomain(data.domain) }),
    },
  })
}

export async function listUsers(opts: {
  q?: string
  role?: UserRole
  status?: 'active' | 'invited' | 'suspended'
  orgId?: string
  skip?: number
  take?: number
}) {
  const where: Prisma.UserWhereInput = {
    ...(opts.role && { role: opts.role }),
    ...(opts.orgId && { memberships: { some: { orgId: opts.orgId } } }),
    ...(opts.status === 'suspended' && { suspendedAt: { not: null } }),
    ...(opts.status === 'invited' && { firebaseUid: { startsWith: 'pending:' }, suspendedAt: null }),
    ...(opts.status === 'active' && { NOT: { firebaseUid: { startsWith: 'pending:' } }, suspendedAt: null }),
    ...(opts.q && {
      OR: [
        { name: { contains: opts.q, mode: 'insensitive' } },
        { email: { contains: opts.q, mode: 'insensitive' } },
        { phone: { contains: opts.q } },
      ],
    }),
  }
  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: opts.skip ?? 0,
      take: Math.min(opts.take ?? 25, 100),
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        firebaseUid: true,
        lastLoginAt: true,
        createdAt: true,
        suspendedAt: true,
        memberships: { select: { org: { select: { id: true, name: true, slug: true } } }, take: 3 },
        _count: { select: { memberships: true } },
      },
    }),
    prisma.user.count({ where }),
  ])
  return {
    items: items.map((u) => ({ ...u, claimed: !u.firebaseUid.startsWith('pending:'), firebaseUid: undefined })),
    total,
  }
}

export async function getConsoleOverview() {
  const DAY = 86_400_000
  const since = new Date(Date.now() - 7 * DAY)
  const [recentUsers, topOrgs, newUsers7d, activeUsers7d] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.assessmentAssignment.groupBy({
      by: ['assessmentId'],
      where: { submittedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: since } } }),
  ])

  // Roll 7-day submissions up to their org.
  const assessments = topOrgs.length
    ? await prisma.assessment.findMany({
        where: { id: { in: topOrgs.map((t) => t.assessmentId) } },
        select: { id: true, org: { select: { id: true, name: true, slug: true } } },
      })
    : []
  const orgOf = new Map(assessments.map((a) => [a.id, a.org]))
  const byOrg = new Map<string, { id: string; name: string; slug: string; submissions: number }>()
  for (const t of topOrgs) {
    const org = orgOf.get(t.assessmentId)
    if (!org) continue
    const row = byOrg.get(org.id) ?? { ...org, submissions: 0 }
    row.submissions += t._count._all
    byOrg.set(org.id, row)
  }
  return {
    recentUsers,
    newUsers7d,
    activeUsers7d,
    activeOrgs: [...byOrg.values()].sort((a, b) => b.submissions - a.submissions).slice(0, 5),
  }
}

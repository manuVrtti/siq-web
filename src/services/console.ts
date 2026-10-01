import 'server-only'

import { cache } from 'react'

import type { OrgStatus, OrgType, Prisma } from '@prisma/client'

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { normalizeDomain } from '@/services/admin'
import { normalizeSlug } from '@/services/organizations'
import { addCollegeStaff } from '@/services/people'
import type { CurrentUser } from '@/types/auth'

/**
 * Super Admin console at scale — hundreds of colleges.
 *
 * The directory computes every per-organization aggregate in a fixed number
 * of grouped queries (never one query per college), then filters, sorts and
 * pages in memory. That's correct and fast into the low thousands of
 * organizations; past that, move the aggregates to a nightly snapshot table.
 */

const DAY = 86_400_000

export type OrgHealth = 'no-admin' | 'no-departments' | 'inactive' | 'healthy'
export const ORG_SORTS = ['name', 'students', 'activity', 'createdAt'] as const
export type OrgSort = (typeof ORG_SORTS)[number]

export type DirectoryFilters = {
  q?: string
  type?: OrgType
  status?: OrgStatus
  state?: string
  health?: OrgHealth
  sort?: OrgSort
  dir?: 'asc' | 'desc'
  skip?: number
  take?: number
}

const toMap = <T extends { orgId: string }>(rows: T[], pick: (r: T) => number) => new Map(rows.map((r) => [r.orgId, pick(r)]))

export const getOrgDirectoryRows = cache(async () => {
  const thirtyAgo = new Date(Date.now() - 30 * DAY)
  const weekAgo = new Date(Date.now() - 7 * DAY)
  const [orgs, students, admins, hods, departments, assessments, lastByTest] = await Promise.all([
    prisma.organization.findMany({
      select: { id: true, name: true, slug: true, type: true, domain: true, city: true, state: true, status: true, createdAt: true },
    }),
    prisma.organizationMember.groupBy({ by: ['orgId'], where: { user: { role: 'STUDENT' } }, _count: { _all: true } }),
    prisma.organizationMember.groupBy({ by: ['orgId'], where: { user: { role: 'COLLEGE_ADMIN', suspendedAt: null } }, _count: { _all: true } }),
    prisma.organizationMember.groupBy({ by: ['orgId'], where: { user: { role: 'COLLEGE_HOD' } }, _count: { _all: true } }),
    prisma.department.groupBy({ by: ['orgId'], _count: { _all: true } }),
    prisma.assessment.findMany({ select: { id: true, orgId: true, status: true } }),
    prisma.assessmentAssignment.groupBy({ by: ['assessmentId'], where: { submittedAt: { not: null } }, _max: { submittedAt: true } }),
  ])
  const week = await prisma.assessmentAssignment.groupBy({
    by: ['assessmentId'],
    where: { submittedAt: { gte: weekAgo } },
    _count: { _all: true },
  })

  const orgOfTest = new Map(assessments.map((a) => [a.id, a.orgId]))
  const lastActivity = new Map<string, Date>()
  for (const g of lastByTest) {
    const org = orgOfTest.get(g.assessmentId)
    const at = g._max.submittedAt
    if (!org || !at) continue
    if (!lastActivity.has(org) || lastActivity.get(org)! < at) lastActivity.set(org, at)
  }
  const submissions7d = new Map<string, number>()
  for (const g of week) {
    const org = orgOfTest.get(g.assessmentId)
    if (org) submissions7d.set(org, (submissions7d.get(org) ?? 0) + g._count._all)
  }
  const tests = new Map<string, { total: number; live: number }>()
  for (const a of assessments) {
    const t = tests.get(a.orgId) ?? { total: 0, live: 0 }
    t.total += 1
    if (a.status === 'PUBLISHED') t.live += 1
    tests.set(a.orgId, t)
  }
  const studentsBy = toMap(students, (r) => r._count._all)
  const adminsBy = toMap(admins, (r) => r._count._all)
  const hodsBy = toMap(hods, (r) => r._count._all)
  const deptsBy = toMap(departments, (r) => r._count._all)

  return orgs.map((o) => {
    const last = lastActivity.get(o.id) ?? null
    const a = adminsBy.get(o.id) ?? 0
    const d = deptsBy.get(o.id) ?? 0
    const health: OrgHealth =
      o.type === 'COLLEGE' && a === 0
        ? 'no-admin'
        : o.type === 'COLLEGE' && d === 0
          ? 'no-departments'
          : !last || last < thirtyAgo
            ? 'inactive'
            : 'healthy'
    return {
      ...o,
      students: studentsBy.get(o.id) ?? 0,
      admins: a,
      hods: hodsBy.get(o.id) ?? 0,
      departments: d,
      tests: tests.get(o.id)?.total ?? 0,
      liveTests: tests.get(o.id)?.live ?? 0,
      submissions7d: submissions7d.get(o.id) ?? 0,
      lastActivity: last,
      health,
    }
  })
})

export type DirectoryRow = Awaited<ReturnType<typeof getOrgDirectoryRows>>[number]

export async function getOrgDirectory(f: DirectoryFilters) {
  const all = await getOrgDirectoryRows()
  const q = f.q?.trim().toLowerCase()
  const filtered = all.filter(
    (o) =>
      (!f.type || o.type === f.type) &&
      (!f.status || o.status === f.status) &&
      (!f.state || o.state === f.state) &&
      (!f.health || o.health === f.health) &&
      (!q || [o.name, o.slug, o.domain, o.city, o.state].some((v) => v?.toLowerCase().includes(q))),
  )
  const dir = f.dir === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    if (f.sort === 'name') return a.name.localeCompare(b.name) * dir
    if (f.sort === 'students') return (a.students - b.students) * dir
    if (f.sort === 'activity') return ((a.lastActivity?.getTime() ?? 0) - (b.lastActivity?.getTime() ?? 0)) * dir
    return (a.createdAt.getTime() - b.createdAt.getTime()) * dir
  })
  const healthCounts = { 'no-admin': 0, 'no-departments': 0, inactive: 0, healthy: 0 } as Record<OrgHealth, number>
  for (const o of all) healthCounts[o.health] += 1
  return {
    items: filtered.slice(f.skip ?? 0, (f.skip ?? 0) + Math.min(f.take ?? 25, 200)),
    filtered,
    total: filtered.length,
    states: [...new Set(all.map((o) => o.state).filter((s): s is string => Boolean(s)))].sort(),
    healthCounts,
    suspended: all.filter((o) => o.status === 'SUSPENDED').length,
  }
}

/* ---- onboarding -------------------------------------------------------- */

export const DEPARTMENT_PRESETS = [
  { code: 'CSE', name: 'Computer Science & Engineering' },
  { code: 'IT', name: 'Information Technology' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering' },
  { code: 'ME', name: 'Mechanical Engineering' },
  { code: 'CE', name: 'Civil Engineering' },
  { code: 'AIML', name: 'CSE (AI & Machine Learning)' },
  { code: 'DS', name: 'CSE (Data Science)' },
  { code: 'CSIT', name: 'Computer Science & Information Technology' },
  { code: 'MCA', name: 'Master of Computer Applications' },
  { code: 'MBA', name: 'Master of Business Administration' },
] as const

export type OnboardInput = {
  name: string
  slug: string
  type: OrgType
  domain?: string | null
  city?: string | null
  state?: string | null
  adminEmails: string[]
  departments: { code: string; name: string }[]
}

/**
 * Onboard a college in one go: the organization, its first College Admins
 * (invited if they've never signed in) and its departments. Each admin goes
 * through the same guarded path as the panels (services/people.ts), so a
 * cross-org or staff account is refused rather than silently changed.
 */
export async function onboardOrganization(actor: CurrentUser, input: OnboardInput) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Only a Super Admin can onboard organizations')
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 200) throw new ValidationError('Enter the organization’s name')
  const slug = normalizeSlug(input.slug)
  if (await prisma.organization.findUnique({ where: { slug }, select: { id: true } })) {
    throw new ValidationError(`The address /${slug} is taken — pick another`)
  }
  const domain = normalizeDomain(input.domain ?? null)
  if (domain && (await prisma.organization.findFirst({ where: { domain }, select: { name: true } }))) {
    throw new ValidationError(`@${domain} already belongs to another organization`)
  }
  const emails = [...new Set(input.adminEmails.map((e) => e.trim().toLowerCase()).filter(Boolean))]
  if (input.type === 'COLLEGE' && emails.length === 0) throw new ValidationError('Add at least one College Admin')
  const departments = input.type === 'COLLEGE' ? dedupeDepartments(input.departments) : []

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      type: input.type,
      domain,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      departments: departments.length ? { create: departments } : undefined,
    },
    select: { id: true, slug: true, name: true },
  })

  const admins: { email: string; ok: boolean; invited?: boolean; error?: string }[] = []
  if (input.type === 'COLLEGE') {
    for (const email of emails) {
      try {
        const r = await addCollegeStaff(actor, org.id, { email, role: 'COLLEGE_ADMIN' })
        admins.push({ email, ok: true, invited: r.invited })
      } catch (e) {
        admins.push({ email, ok: false, error: e instanceof Error ? e.message : 'Could not add' })
      }
    }
  }
  return { org, admins, departments: departments.length }
}

function dedupeDepartments(list: { code: string; name: string }[]) {
  const seen = new Set<string>()
  const out: { code: string; name: string }[] = []
  for (const d of list) {
    const code = d.code.trim().toUpperCase().replace(/\s+/g, '')
    const name = d.name.trim().replace(/\s+/g, ' ')
    if (!/^[A-Z0-9&.-]{2,12}$/.test(code) || name.length < 2 || seen.has(code)) continue
    seen.add(code)
    out.push({ code, name })
  }
  return out
}

/* ---- status + profile -------------------------------------------------- */

export async function setOrganizationStatus(actor: CurrentUser, orgId: string, status: OrgStatus, reason: string | null) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Only a Super Admin can do this')
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { status: true } })
  if (!org) throw new NotFoundError('Organization not found')
  await prisma.organization.update({
    where: { id: orgId },
    data:
      status === 'SUSPENDED'
        ? { status, suspendedAt: new Date(), suspendedReason: reason?.trim().slice(0, 300) || null }
        : { status, suspendedAt: null, suspendedReason: null },
  })
  return { from: org.status, to: status }
}

export async function updateOrganizationProfile(
  actor: CurrentUser,
  orgId: string,
  input: { name?: string; domain?: string | null; city?: string | null; state?: string | null },
) {
  if (actor.role !== 'SUPER_ADMIN') throw new ForbiddenError('Only a Super Admin can do this')
  const data: Prisma.OrganizationUpdateInput = {}
  if (input.name !== undefined) {
    const n = input.name.trim()
    if (n.length < 2) throw new ValidationError('Enter a name')
    data.name = n
  }
  if (input.domain !== undefined) {
    const d = normalizeDomain(input.domain)
    if (d && (await prisma.organization.findFirst({ where: { domain: d, NOT: { id: orgId } }, select: { id: true } }))) {
      throw new ValidationError(`@${d} already belongs to another organization`)
    }
    data.domain = d
  }
  if (input.city !== undefined) data.city = input.city?.trim() || null
  if (input.state !== undefined) data.state = input.state?.trim() || null
  return prisma.organization.update({ where: { id: orgId }, data })
}

/* ---- global search ----------------------------------------------------- */

export async function searchConsole(raw: string) {
  const q = raw.trim()
  if (q.length < 2) return { orgs: [], people: [], departments: [] }
  const ci = { contains: q, mode: 'insensitive' as const }
  const [orgs, people, departments] = await Promise.all([
    prisma.organization.findMany({
      where: { OR: [{ name: ci }, { slug: ci }, { domain: ci }, { city: ci }, { state: ci }] },
      take: 10,
      orderBy: { name: 'asc' },
      select: { id: true, name: true, slug: true, type: true, city: true, status: true },
    }),
    prisma.user.findMany({
      where: { OR: [{ name: ci }, { email: ci }, { phone: { contains: q } }] },
      take: 15,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        suspendedAt: true,
        memberships: { take: 1, select: { org: { select: { name: true } } } },
      },
    }),
    prisma.department.findMany({
      where: { OR: [{ code: ci }, { name: ci }] },
      take: 10,
      select: { id: true, code: true, name: true, org: { select: { id: true, name: true } } },
    }),
  ])
  return { orgs, people, departments }
}

/** Fourteen-day submission series for one organization (college overview). */
export async function orgActivitySeries(orgId: string) {
  const since = new Date(Date.now() - 14 * DAY)
  const rows = await prisma.assessmentAssignment.findMany({
    where: { submittedAt: { gte: since }, assessment: { orgId } },
    select: { submittedAt: true },
  })
  const buckets = Array.from({ length: 14 }, () => 0)
  for (const r of rows) {
    const i = 13 - Math.floor((Date.now() - r.submittedAt!.getTime()) / DAY)
    if (i >= 0 && i < 14) buckets[i]! += 1
  }
  return buckets
}

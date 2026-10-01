import 'server-only'

import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'

import { NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { normalizeEmail, normalizePhone } from '@/lib/validators/contact'

/**
 * Plan 013 — candidates + batches.
 *
 * A "candidate" is a STUDENT `User` with a membership in the org. Imports
 * create pending rows the student CLAIMS on their first sign-in (see the
 * `pending:` uid prefix and the claim branch in /api/auth/session).
 */

/* ---- parsing ----------------------------------------------------------- */

/** Splits a pasted list into deduped, normalised email/phone entries. */
export function parseCandidateList(raw: string): {
  emails: string[]
  phones: string[]
  invalid: string[]
} {
  const emails = new Set<string>()
  const phones = new Set<string>()
  const invalid: string[] = []

  for (const token of raw.split(/[\s,;]+/)) {
    const v = token.trim()
    if (!v) continue
    const email = normalizeEmail(v)
    if (email) {
      emails.add(email)
      continue
    }
    const phone = normalizePhone(v)
    if (phone) {
      phones.add(phone)
      continue
    }
    invalid.push(v)
  }

  return { emails: [...emails], phones: [...phones], invalid }
}

/* ---- listing ----------------------------------------------------------- */

export const CANDIDATE_SORTS = ['createdAt', 'name', 'lastLoginAt'] as const
export type CandidateSort = (typeof CANDIDATE_SORTS)[number]

export type CandidateFilters = {
  search?: string
  batchId?: string
  /** 'active' = has signed in at least once; 'pending' = invited, never claimed. */
  status?: 'active' | 'pending'
  skip?: number
  take?: number
  sort?: CandidateSort
  dir?: 'asc' | 'desc'
}

/**
 * `nulls: 'last'` is only valid on nullable columns — Prisma rejects it on
 * createdAt at runtime. It keeps never-logged-in / unnamed candidates from
 * floating to the top of a "last active" or name sort.
 */
function candidateOrderBy(
  sort: CandidateSort,
  dir: 'asc' | 'desc',
): Prisma.UserOrderByWithRelationInput {
  if (sort === 'name') return { name: { sort: dir, nulls: 'last' } }
  if (sort === 'lastLoginAt') return { lastLoginAt: { sort: dir, nulls: 'last' } }
  return { createdAt: dir }
}

/**
 * Candidates = STUDENT users in this org. Joined via OrganizationMember so a
 * user can belong to multiple colleges without cross-tenant leakage.
 */
export async function listCandidates(orgId: string, filters: CandidateFilters = {}) {
  const where: Prisma.UserWhereInput = {
    role: 'STUDENT',
    memberships: { some: { orgId } },
    ...(filters.batchId && { batchMemberships: { some: { batchId: filters.batchId } } }),
    ...(filters.status === 'pending' && { firebaseUid: { startsWith: 'pending:' } }),
    ...(filters.status === 'active' && { NOT: { firebaseUid: { startsWith: 'pending:' } } }),
    ...(filters.search && {
      OR: [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ],
    }),
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [candidateOrderBy(filters.sort ?? 'createdAt', filters.dir ?? 'desc'), { id: 'asc' }],
      skip: filters.skip ?? 0,
      take: Math.min(filters.take ?? 50, 200),
      select: {
        id: true,
        email: true,
        phone: true,
        name: true,
        firebaseUid: true,
        lastLoginAt: true,
        createdAt: true,
        // Batches are org-scoped by construction; filter anyway so a student
        // in two colleges never shows the other college's batch names.
        batchMemberships: {
          where: { batch: { orgId } },
          select: { batch: { select: { id: true, name: true } } },
        },
        _count: { select: { memberships: true, assignments: { where: { assessment: { orgId } } } } },
      },
    }),
    prisma.user.count({ where }),
  ])

  // A row whose firebaseUid still starts with `pending:` has never been claimed.
  return {
    items: items.map((u) => {
      const claimed = !u.firebaseUid.startsWith('pending:')
      // Same rule as candidateEditability — kept in sync so the menu never offers an edit the API refuses.
      return { ...u, claimed, editable: !claimed && u._count.memberships === 1 }
    }),
    total,
  }
}

/* ---- import ------------------------------------------------------------ */

export type ImportResult = {
  createdUsers: number
  claimedExisting: number
  addedMemberships: number
  invalid: string[]
}

/**
 * Bulk-import a list of candidates by email and/or phone.
 *
 * For each unique contact:
 *   - if a User already exists (by email or phone) → add an org membership if
 *     they don't already have one; leave the row alone otherwise.
 *   - otherwise → create a pending User (firebaseUid = `pending:<cuid>`) with
 *     STUDENT role and add the org membership.
 *
 * The pending uid is what makes the claim-on-first-login (session route) safe:
 * a real Firebase uid can never start with `pending:`.
 */
export async function importCandidates(orgId: string, raw: string): Promise<ImportResult> {
  const parsed = parseCandidateList(raw)
  const result: ImportResult = {
    createdUsers: 0,
    claimedExisting: 0,
    addedMemberships: 0,
    invalid: parsed.invalid,
  }

  // Batch the DB work: fetch every already-existing row in one round trip, then
  // decide row-by-row.
  const existing = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: parsed.emails } },
        { phone: { in: parsed.phones } },
      ],
    },
    select: { id: true, email: true, phone: true, role: true },
  })
  const byEmail = new Map(existing.filter((u) => u.email).map((u) => [u.email!, u]))
  const byPhone = new Map(existing.filter((u) => u.phone).map((u) => [u.phone!, u]))

  for (const email of parsed.emails) {
    const found = byEmail.get(email)
    if (found) {
      result.claimedExisting += 1
      if (await ensureMembership(orgId, found.id)) result.addedMemberships += 1
    } else {
      const created = await prisma.user.create({
        data: {
          email,
          firebaseUid: `pending:${randomUUID()}`,
          role: 'STUDENT',
        },
      })
      result.createdUsers += 1
      if (await ensureMembership(orgId, created.id)) result.addedMemberships += 1
    }
  }

  for (const phone of parsed.phones) {
    const found = byPhone.get(phone)
    if (found) {
      result.claimedExisting += 1
      if (await ensureMembership(orgId, found.id)) result.addedMemberships += 1
    } else {
      const created = await prisma.user.create({
        data: {
          phone,
          firebaseUid: `pending:${randomUUID()}`,
          role: 'STUDENT',
        },
      })
      result.createdUsers += 1
      if (await ensureMembership(orgId, created.id)) result.addedMemberships += 1
    }
  }

  return result
}

async function ensureMembership(orgId: string, userId: string): Promise<boolean> {
  try {
    await prisma.organizationMember.create({ data: { orgId, userId, role: 'MEMBER' } })
    return true
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false // already a member
    throw e
  }
}

/* ---- batches ----------------------------------------------------------- */

export async function listBatches(orgId: string) {
  return prisma.batch.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { members: true } } },
  })
}

export async function createBatch(orgId: string, name: string, description?: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Batch name is required')
  try {
    return await prisma.batch.create({
      data: { orgId, name: trimmed, description: description?.trim() || null },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ValidationError('A batch with that name already exists')
    }
    throw e
  }
}

async function assertBatchInOrg(orgId: string, batchId: string) {
  const b = await prisma.batch.findUnique({ where: { id: batchId }, select: { orgId: true } })
  if (!b || b.orgId !== orgId) throw new NotFoundError('Batch not found')
}

/** Upper bound on one add-to-batch call — a whole roster page, with headroom. */
export const MAX_BATCH_ADD = 1000

export async function addToBatch(orgId: string, batchId: string, rawUserIds: string[]) {
  // Dedupe first: the ownership check compares counts, so a repeated id
  // would otherwise fail as "not a member of this organization".
  const userIds = [...new Set(rawUserIds)]
  if (userIds.length === 0) return
  if (userIds.length > MAX_BATCH_ADD) {
    throw new ValidationError(`Add at most ${MAX_BATCH_ADD} candidates at a time`)
  }
  await assertBatchInOrg(orgId, batchId)
  // Every user must be a member of the org — no borrowing across tenants.
  const owned = await prisma.user.count({
    where: { id: { in: userIds }, memberships: { some: { orgId } } },
  })
  if (owned !== userIds.length) {
    throw new ValidationError('One or more users are not members of this organization')
  }
  await prisma.batchMember.createMany({
    data: userIds.map((userId) => ({ batchId, userId })),
    skipDuplicates: true,
  })
}

export async function removeFromBatch(orgId: string, batchId: string, userId: string) {
  await assertBatchInOrg(orgId, batchId)
  await prisma.batchMember.deleteMany({ where: { batchId, userId } })
}

export async function deleteBatch(orgId: string, batchId: string) {
  await assertBatchInOrg(orgId, batchId)
  await prisma.batch.delete({ where: { id: batchId } })
}

/* ---- edit + remove ----------------------------------------------------- */

/** Upper bound on one remove call — matches add-to-batch. */
export const MAX_REMOVE = MAX_BATCH_ADD

/**
 * Who may have their contact details edited by a college:
 * only rows that have NEVER signed in, and only when this college is their
 * sole roster. Once a student signs in, their name/email/phone belong to
 * them (they edit them in their profile); and a pending row shared with
 * another college can't be rewritten from one tenant.
 */
export async function candidateEditability(orgId: string, userId: string) {
  const u = await prisma.user.findFirst({
    where: { id: userId, role: 'STUDENT', memberships: { some: { orgId } } },
    select: { firebaseUid: true, _count: { select: { memberships: true } } },
  })
  if (!u) throw new NotFoundError('Candidate not found')
  if (!u.firebaseUid.startsWith('pending:')) return { editable: false as const, reason: 'signed-in' as const }
  if (u._count.memberships > 1) return { editable: false as const, reason: 'shared' as const }
  return { editable: true as const, reason: null }
}

export async function updateCandidate(
  orgId: string,
  userId: string,
  input: { name?: string | null; email?: string | null; phone?: string | null },
) {
  const check = await candidateEditability(orgId, userId)
  if (!check.editable) {
    throw new ValidationError(
      check.reason === 'signed-in'
        ? 'This candidate has signed in — they manage their own details from their profile.'
        : 'This candidate is also on another college’s roster, so their details can’t be changed here.',
    )
  }

  const data: Prisma.UserUpdateInput = {}
  if (input.name !== undefined) data.name = input.name?.trim() ? input.name.trim().slice(0, 120) : null
  if (input.email !== undefined) {
    if (input.email === null || input.email.trim() === '') data.email = null
    else {
      const email = normalizeEmail(input.email)
      if (!email) throw new ValidationError('Enter a valid email address')
      data.email = email
    }
  }
  if (input.phone !== undefined) {
    if (input.phone === null || input.phone.trim() === '') data.phone = null
    else {
      const phone = normalizePhone(input.phone)
      if (!phone) throw new ValidationError('Enter a valid 10-digit mobile number')
      data.phone = phone
    }
  }

  // A pending row with neither contact can never be claimed — refuse.
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, phone: true } })
  const nextEmail = data.email === undefined ? current.email : (data.email as string | null)
  const nextPhone = data.phone === undefined ? current.phone : (data.phone as string | null)
  if (!nextEmail && !nextPhone) throw new ValidationError('Keep an email or a phone number so they can sign in')

  try {
    return await prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, name: true, email: true, phone: true },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ValidationError('Another account already uses that email or phone number')
    }
    throw e
  }
}

export type RemoveResult = { removed: number; deletedAccounts: number; cancelledInvites: number }

/**
 * Take candidates off this college's roster.
 *
 *   - org membership, this college's batch memberships and NOT-YET-STARTED
 *     invitations to this college's exams are removed;
 *   - started / submitted attempts and results stay, so exam records and
 *     analytics remain truthful;
 *   - a never-signed-in row with no other college and no exam history is
 *     deleted outright, so the email/phone can be re-imported cleanly.
 *
 * Other colleges' data for the same student is never touched.
 */
export async function removeCandidates(orgId: string, rawUserIds: string[]): Promise<RemoveResult> {
  const userIds = [...new Set(rawUserIds)]
  if (userIds.length === 0) return { removed: 0, deletedAccounts: 0, cancelledInvites: 0 }
  if (userIds.length > MAX_REMOVE) throw new ValidationError(`Remove at most ${MAX_REMOVE} candidates at a time`)

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, role: 'STUDENT', memberships: { some: { orgId } } },
    select: {
      id: true,
      firebaseUid: true,
      _count: { select: { memberships: true, examAttempts: true } },
    },
  })
  if (users.length !== userIds.length) {
    throw new ValidationError('One or more candidates are not on this college’s roster')
  }

  const ids = users.map((u) => u.id)
  const purge = users
    .filter((u) => u.firebaseUid.startsWith('pending:') && u._count.memberships === 1 && u._count.examAttempts === 0)
    .map((u) => u.id)

  const [, cancelled, , deleted] = await prisma.$transaction([
    prisma.batchMember.deleteMany({ where: { userId: { in: ids }, batch: { orgId } } }),
    prisma.assessmentAssignment.deleteMany({
      where: { userId: { in: ids }, status: 'INVITED', assessment: { orgId } },
    }),
    prisma.organizationMember.deleteMany({ where: { userId: { in: ids }, orgId } }),
    prisma.user.deleteMany({ where: { id: { in: purge } } }),
  ])

  return { removed: ids.length, deletedAccounts: deleted.count, cancelledInvites: cancelled.count }
}

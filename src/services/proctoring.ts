import 'server-only'

import type { FlagSeverity, ProctoringFlagType, Prisma } from '@prisma/client'

import { ForbiddenError, NotFoundError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { deleteFile, getSignedUrl, uploadFile } from '@/lib/storage'
import { FILE_LIMITS } from '@/lib/validators/file'
import { MAX_CHECKS_PER_ATTEMPT } from '@/lib/proctoring/identity-rules'
import { getIdentityForReview } from '@/services/identity'
import { assessRisk, type Risk } from '@/lib/proctoring/integrity'

/**
 * Plan 018 — server-side proctoring.
 *
 * Two write paths (`initSession`, `recordFlag`) and two read paths
 * (`getSessionForAdmin`, `summariseFlags`). Both writes derive the tenant
 * from the assignment token so a leaked sessionId alone doesn't grant
 * access. Face comparison itself is never done here — see
 * `lib/proctoring/face-detection.ts`; the server only stores the numeric
 * similarity score the client reports.
 */

const PROCTORING_BUCKET = FILE_LIMITS.proctoring.bucket

/**
 * Resolve the (attempt, userId) pair from a token so proctoring calls can
 * be tenant-checked without trusting a client-provided attemptId. Throws if
 * the token is unknown, unassigned or belongs to a different user.
 */
async function resolveAttemptForUser(token: string, userId: string) {
  const assignment = await prisma.assessmentAssignment.findUnique({
    where: { token },
    include: {
      assessment: { select: { orgId: true } },
      attempt: true,
    },
  })
  if (!assignment) throw new NotFoundError('Assignment not found')
  if (assignment.userId !== userId) throw new ForbiddenError('Wrong user for this token')
  if (!assignment.attempt) throw new NotFoundError('No attempt has started yet')
  return {
    attemptId: assignment.attempt.id,
    orgId: assignment.assessment.orgId,
    assignmentId: assignment.id,
  }
}

/**
 * Create the ProctoringSession row + upload the reference photo. Idempotent:
 * a second call for the same attempt returns the existing session and skips
 * re-upload (the client may retry on flaky networks).
 */
export async function initSession(input: {
  token: string
  userId: string
  /** Absent for an activity-only session (test without camera proctoring). */
  photo?: Buffer | null
  contentType?: string
}): Promise<{
  sessionId: string
  referencePhotoPath: string | null
}> {
  const { attemptId, assignmentId } = await resolveAttemptForUser(input.token, input.userId)

  const existing = await prisma.proctoringSession.findUnique({
    where: { attemptId },
  })
  if (existing) {
    // An activity-only session gains its camera reference later (same attempt).
    if (!existing.referencePhotoUrl && input.photo && input.contentType) {
      const path = `attempts/${attemptId}/reference.${extensionForContentType(input.contentType)}`
      await uploadFile(PROCTORING_BUCKET, path, input.photo, input.contentType)
      await prisma.proctoringSession.update({ where: { id: existing.id }, data: { referencePhotoUrl: path } })
      return { sessionId: existing.id, referencePhotoPath: path }
    }
    return { sessionId: existing.id, referencePhotoPath: existing.referencePhotoUrl }
  }

  if (!input.photo || !input.contentType) {
    const session = await prisma.proctoringSession.create({ data: { attemptId, userId: input.userId } })
    await carryIdentityMismatch(session.id, assignmentId)
    return { sessionId: session.id, referencePhotoPath: null }
  }

  // Store reference photo under a stable, attempt-scoped path so we can find
  // it later without an extra DB read. `.upsert:true` means a retry after a
  // half-failed init overwrites cleanly rather than leaving orphans.
  const path = `attempts/${attemptId}/reference.${extensionForContentType(input.contentType)}`
  await uploadFile(PROCTORING_BUCKET, path, input.photo, input.contentType)

  const session = await prisma.proctoringSession.create({
    data: {
      attemptId,
      userId: input.userId,
      referencePhotoUrl: path,
    },
  })
  await carryIdentityMismatch(session.id, assignmentId)
  return { sessionId: session.id, referencePhotoPath: path }
}

/** A failed pre-exam identity check becomes a HIGH alert in the attempt's log. */
async function carryIdentityMismatch(sessionId: string, assignmentId: string) {
  const check = await prisma.identityCheck.findUnique({ where: { assignmentId }, select: { outcome: true, matchScore: true, attempts: true } })
  if (check?.outcome !== 'MISMATCH') return
  await prisma.$transaction([
    prisma.proctoringFlag.create({
      data: { sessionId, type: 'IDENTITY_MISMATCH', severity: 'HIGH', similarity: check.matchScore, metadata: { attempts: check.attempts, stage: 'pre-exam' } },
    }),
    prisma.proctoringSession.update({ where: { id: sessionId }, data: { flagCount: { increment: 1 } } }),
  ])
}

/**
 * Plan 018b — one random in-exam identity check. Stored with its snapshot
 * for human review; a different (single) face also raises FACE_MISMATCH.
 */
export async function recordCheck(input: {
  token: string
  userId: string
  matched: boolean
  matchScore: number | null
  faceCount: number
  snapshot: { buffer: Buffer; contentType: string } | null
}) {
  const { attemptId } = await resolveAttemptForUser(input.token, input.userId)
  const session = await prisma.proctoringSession.findUnique({ where: { attemptId }, select: { id: true, _count: { select: { checks: true } } } })
  if (!session) throw new NotFoundError('Proctoring session not initialised')
  if (session._count.checks >= MAX_CHECKS_PER_ATTEMPT) return { id: null, capped: true }

  let snapshotPath: string | null = null
  if (input.snapshot) {
    snapshotPath = `attempts/${attemptId}/checks/${Date.now()}-${cryptoRandom(4)}.${extensionForContentType(input.snapshot.contentType)}`
    await uploadFile(PROCTORING_BUCKET, snapshotPath, input.snapshot.buffer, input.snapshot.contentType)
  }
  const check = await prisma.proctoringCheck.create({
    data: { sessionId: session.id, matched: input.matched, matchScore: input.matchScore, faceCount: input.faceCount, snapshotPath },
  })
  await prisma.proctoringSession.update({ where: { id: session.id }, data: { snapshotCount: snapshotPath ? { increment: 1 } : undefined } })
  if (!input.matched && input.faceCount === 1) {
    await prisma.$transaction([
      prisma.proctoringFlag.create({
        data: { sessionId: session.id, type: 'FACE_MISMATCH', severity: 'HIGH', similarity: input.matchScore, snapshotUrl: snapshotPath, metadata: { stage: 'random-check' } },
      }),
      prisma.proctoringSession.update({ where: { id: session.id }, data: { flagCount: { increment: 1 } } }),
    ])
  }
  return { id: check.id, capped: false }
}

/**
 * Persist one flag. `snapshot` is optional and only uploaded when the
 * assessment has `storeSnapshots=true` — otherwise we keep the flag but
 * throw the pixels away (privacy + storage cost). The client already knows
 * this policy and passes null in that case.
 */
export async function recordFlag(input: {
  token: string
  userId: string
  type: ProctoringFlagType
  severity: FlagSeverity
  similarity?: number | null
  metadata?: Prisma.InputJsonValue | null
  snapshot?: { buffer: Buffer; contentType: string } | null
}): Promise<{ id: string }> {
  const { attemptId } = await resolveAttemptForUser(input.token, input.userId)

  const session = await prisma.proctoringSession.findUnique({
    where: { attemptId },
    select: { id: true },
  })
  if (!session) throw new NotFoundError('Proctoring session not initialised')

  let snapshotUrl: string | null = null
  if (input.snapshot) {
    // One object per flag id keeps deletion trivial when we ever prune.
    const path = `attempts/${attemptId}/snapshots/${Date.now()}-${cryptoRandom(6)}.${extensionForContentType(
      input.snapshot.contentType,
    )}`
    await uploadFile(PROCTORING_BUCKET, path, input.snapshot.buffer, input.snapshot.contentType)
    snapshotUrl = path
  }

  const [flag] = await prisma.$transaction([
    prisma.proctoringFlag.create({
      data: {
        sessionId: session.id,
        type: input.type,
        severity: input.severity,
        similarity: input.similarity ?? null,
        snapshotUrl,
        metadata: input.metadata ?? undefined,
      },
    }),
    prisma.proctoringSession.update({
      where: { id: session.id },
      data: {
        flagCount: { increment: 1 },
        snapshotCount: input.snapshot ? { increment: 1 } : undefined,
      },
    }),
  ])
  return flag
}

/**
 * Fetch a session + its flags for admin review. Tenant-checked: the session
 * must belong to an attempt on an assessment in the manager's org.
 * Snapshot URLs are minted as short-lived signed URLs, not returned as
 * bucket paths.
 */
export async function getSessionForAdmin(orgId: string, sessionId: string) {
  // ExamAttempt carries only `assessmentId` (no relation), so pull the
  // session + attempt-scalar first, then look up the assessment separately
  // and verify tenant against it.
  const session = await prisma.proctoringSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      flags: { orderBy: { occurredAt: 'asc' } },
      checks: { orderBy: { occurredAt: 'asc' } },
      attempt: { select: { id: true, assessmentId: true, assignmentId: true } },
    },
  })
  if (!session) throw new NotFoundError('Proctoring session not found')

  const assessment = await prisma.assessment.findUnique({
    where: { id: session.attempt.assessmentId },
    select: { title: true, orgId: true, storeSnapshots: true },
  })
  if (!assessment || assessment.orgId !== orgId) {
    throw new NotFoundError('Proctoring session not found')
  }

  // Sign each snapshot URL + the reference photo. 5-minute TTL is long enough
  // for the whole review page to render without being generous with links.
  const [referenceSignedUrl, flagsWithSignedUrls, checksWithSignedUrls, identity] = await Promise.all([
    session.referencePhotoUrl
      ? getSignedUrl(PROCTORING_BUCKET, session.referencePhotoUrl, 300)
      : Promise.resolve(null),
    Promise.all(
      session.flags.map(async (f) => ({
        ...f,
        snapshotSignedUrl: f.snapshotUrl
          ? await getSignedUrl(PROCTORING_BUCKET, f.snapshotUrl, 300)
          : null,
      })),
    ),
    Promise.all(
      session.checks.map(async (c) => ({
        ...c,
        snapshotSignedUrl: c.snapshotPath ? await getSignedUrl(PROCTORING_BUCKET, c.snapshotPath, 300).catch(() => null) : null,
      })),
    ),
    getIdentityForReview(session.attempt.assignmentId),
  ])

  return {
    id: session.id,
    attemptId: session.attemptId,
    user: session.user,
    createdAt: session.createdAt,
    flagCount: session.flagCount,
    snapshotCount: session.snapshotCount,
    referenceSignedUrl,
    assessment: { title: assessment.title, storeSnapshots: assessment.storeSnapshots },
    flags: flagsWithSignedUrls,
    checks: checksWithSignedUrls,
    identity,
  }
}

/**
 * Cheap summary for the admin results list. Groups by type and computes
 * the most severe severity present — used to render a single "flag badge"
 * on the result row without loading every flag body.
 */
export async function summariseFlagsForResult(attemptId: string) {
  const session = await prisma.proctoringSession.findUnique({
    where: { attemptId },
    select: {
      id: true,
      flagCount: true,
      snapshotCount: true,
      flags: { select: { type: true, severity: true } },
    },
  })
  if (!session) return null

  const byType = new Map<ProctoringFlagType, number>()
  let maxSeverity: FlagSeverity | null = null
  const severityRank: Record<FlagSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 }
  for (const f of session.flags) {
    byType.set(f.type, (byType.get(f.type) ?? 0) + 1)
    if (maxSeverity === null || severityRank[f.severity] > severityRank[maxSeverity]) {
      maxSeverity = f.severity
    }
  }
  return {
    sessionId: session.id,
    flagCount: session.flagCount,
    snapshotCount: session.snapshotCount,
    byType: Object.fromEntries(byType),
    maxSeverity,
  }
}

/** Cleanup — used by tests / rare admin action. Cascades via Prisma. */
export async function deleteSession(sessionId: string) {
  const session = await prisma.proctoringSession.findUnique({
    where: { id: sessionId },
    include: { flags: true },
  })
  if (!session) return
  const paths = [session.referencePhotoUrl, ...session.flags.map((f) => f.snapshotUrl)].filter(
    (p): p is string => Boolean(p),
  )
  for (const p of paths) {
    try {
      await deleteFile(PROCTORING_BUCKET, p)
    } catch {
      // A stale path is not fatal — the row still needs to go.
    }
  }
  await prisma.proctoringSession.delete({ where: { id: sessionId } })
}

function extensionForContentType(ct: string): 'jpg' | 'png' | 'webp' {
  if (ct === 'image/png') return 'png'
  if (ct === 'image/webp') return 'webp'
  return 'jpg'
}

function cryptoRandom(bytes: number): string {
  // Node ≥19 exposes crypto globally in the App Router runtime.
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Plan 018b — integrity at a glance for many assignments (mock-drive monitor,
 * results list): risk level, flag count and the result to open.
 */
export async function integrityByAssignment(assignmentIds: string[]) {
  const ids = [...new Set(assignmentIds)]
  if (ids.length === 0) return new Map<string, { risk: Risk; flags: number; resultId: string | null }>()
  const [sessions, identities] = await Promise.all([
    prisma.proctoringSession.findMany({
      where: { attempt: { assignmentId: { in: ids } } },
      select: {
        attempt: { select: { assignmentId: true, result: { select: { id: true } } } },
        flags: { select: { type: true, severity: true } },
        checks: { where: { matched: false }, select: { id: true } },
      },
    }),
    prisma.identityCheck.findMany({ where: { assignmentId: { in: ids } }, select: { assignmentId: true, outcome: true } }),
  ])
  const outcome = new Map(identities.map((i) => [i.assignmentId, i.outcome]))
  const out = new Map<string, { risk: Risk; flags: number; resultId: string | null }>()
  for (const s of sessions) {
    const aid = s.attempt.assignmentId
    out.set(aid, {
      risk: assessRisk({ flags: s.flags, identityOutcome: outcome.get(aid), checksFailed: s.checks.length }),
      flags: s.flags.length,
      resultId: s.attempt.result?.id ?? null,
    })
  }
  return out
}

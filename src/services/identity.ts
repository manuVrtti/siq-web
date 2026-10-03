import 'server-only'

import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { IDENTITY_MAX_ATTEMPTS, MIN_MATCH_CONFIDENCE } from '@/lib/proctoring/identity-rules'
import { getSignedUrl, uploadFile } from '@/lib/storage'
import { FILE_LIMITS } from '@/lib/validators/file'

/**
 * Plan 018b — the pre-exam identity step.
 *
 * A student's ID photo is the latest APPROVED IdentityPhoto. At the first
 * proctored exam there is none: the live selfie becomes it (ENROLLED). From
 * then on the live photo is compared ON THE STUDENT'S DEVICE with the ID
 * photo; the server records the outcome, keeps the live photo for human
 * review, and refuses outcomes that contradict the reported score.
 *
 * Trust boundary: the comparison runs on the client, so a tampered client
 * could lie — which is why every check stores the photo for a person to see.
 */

const BUCKET = FILE_LIMITS.proctoring.bucket

async function resolveAssignment(token: string, userId: string) {
  const a = await prisma.assessmentAssignment.findUnique({
    where: { token },
    select: {
      id: true,
      userId: true,
      assessment: { select: { proctoringEnabled: true, orgId: true } },
      identityCheck: { select: { outcome: true, matchScore: true } },
    },
  })
  if (!a) throw new NotFoundError('Assignment not found')
  if (a.userId !== userId) throw new ForbiddenError('Wrong user for this token')
  return a
}

export async function getActivePhoto(userId: string) {
  return prisma.identityPhoto.findFirst({
    where: { userId, status: 'APPROVED' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, storagePath: true, source: true, createdAt: true },
  })
}

/** What the identity step needs to know before the exam. */
export async function getIdentityStatus(token: string, userId: string) {
  const a = await resolveAssignment(token, userId)
  if (!a.assessment.proctoringEnabled) return { required: false, done: true, outcome: null, idPhotoUrl: null }
  if (a.identityCheck) return { required: true, done: true, outcome: a.identityCheck.outcome, idPhotoUrl: null }
  const photo = await getActivePhoto(userId)
  return {
    required: true,
    done: false,
    outcome: null,
    // Short-lived: the browser downloads it once to compare on-device.
    idPhotoUrl: photo ? await getSignedUrl(BUCKET, photo.storagePath, 120) : null,
  }
}

const ext = (ct: string) => (ct === 'image/png' ? 'png' : ct === 'image/webp' ? 'webp' : 'jpg')

export async function submitIdentityCheck(input: {
  token: string
  userId: string
  snapshot: { buffer: Buffer; contentType: string }
  outcome: string
  matchScore: number | null
  attempts: number
}) {
  const a = await resolveAssignment(input.token, input.userId)
  if (!a.assessment.proctoringEnabled) throw new ValidationError('This test has no identity check')
  if (a.identityCheck) return { outcome: a.identityCheck.outcome, matchScore: a.identityCheck.matchScore, existing: true }

  const attempts = Math.trunc(input.attempts)
  if (!(attempts >= 1 && attempts <= IDENTITY_MAX_ATTEMPTS)) throw new ValidationError('Invalid number of attempts')

  const stamp = Date.now()
  const snapshotPath = `identity/checks/${a.id}-${stamp}.${ext(input.snapshot.contentType)}`
  const photo = await getActivePhoto(input.userId)

  if (!photo) {
    // First proctored exam: this verified selfie becomes the ID photo.
    const photoPath = `identity/photos/${input.userId}/${stamp}.${ext(input.snapshot.contentType)}`
    await uploadFile(BUCKET, photoPath, input.snapshot.buffer, input.snapshot.contentType)
    await uploadFile(BUCKET, snapshotPath, input.snapshot.buffer, input.snapshot.contentType)
    const created = await prisma.identityPhoto.create({
      data: { userId: input.userId, storagePath: photoPath, source: 'SELFIE', status: 'APPROVED', orgId: a.assessment.orgId },
    })
    await prisma.identityCheck.create({
      data: { assignmentId: a.id, userId: input.userId, outcome: 'ENROLLED', attempts, snapshotPath, photoId: created.id },
    })
    return { outcome: 'ENROLLED', matchScore: null, existing: false }
  }

  // Compared against an existing ID photo: the report must be self-consistent.
  // matchScore is the calibrated confidence (018c), 0–1.
  const score = input.matchScore
  if (input.outcome === 'MATCHED') {
    if (score === null || !(score >= MIN_MATCH_CONFIDENCE && score <= 1)) throw new ValidationError('A match needs a passing score')
  } else if (input.outcome === 'MISMATCH') {
    if (score !== null && !(score >= 0 && score < MIN_MATCH_CONFIDENCE)) throw new ValidationError('A mismatch needs a failing score')
    if (attempts !== IDENTITY_MAX_ATTEMPTS) throw new ValidationError(`Try ${IDENTITY_MAX_ATTEMPTS} times before continuing`)
  } else {
    throw new ValidationError('Outcome must be MATCHED or MISMATCH')
  }

  await uploadFile(BUCKET, snapshotPath, input.snapshot.buffer, input.snapshot.contentType)
  await prisma.identityCheck.create({
    data: { assignmentId: a.id, userId: input.userId, outcome: input.outcome, matchScore: score, attempts, snapshotPath, photoId: photo.id },
  })
  return { outcome: input.outcome, matchScore: score, existing: false }
}

/** Staff review: the ID photo used and the live photo, side by side. */
export async function getIdentityForReview(ref: { attemptId: string; assignmentId: string | null }) {
  const c = await prisma.identityCheck.findFirst({
    where: { OR: [{ attemptId: ref.attemptId }, ...(ref.assignmentId ? [{ assignmentId: ref.assignmentId, attemptId: null }] : [])] },
    select: {
      outcome: true,
      matchScore: true,
      attempts: true,
      snapshotPath: true,
      createdAt: true,
      photo: { select: { storagePath: true, source: true, createdAt: true } },
    },
  })
  if (!c) return null
  const [liveUrl, idUrl] = await Promise.all([
    getSignedUrl(BUCKET, c.snapshotPath, 300).catch(() => null),
    c.photo ? getSignedUrl(BUCKET, c.photo.storagePath, 300).catch(() => null) : Promise.resolve(null),
  ])
  return {
    outcome: c.outcome as 'ENROLLED' | 'MATCHED' | 'MISMATCH',
    matchScore: c.matchScore,
    attempts: c.attempts,
    at: c.createdAt,
    liveUrl,
    idUrl,
    idSource: c.photo?.source ?? null,
  }
}

import 'server-only'

import { Prisma, type OrgType } from '@prisma/client'

import { ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'
import { normalizeDomain } from '@/services/admin'

/**
 * Plan T01 — organization provisioning.
 *
 * The real "onboard a college" path, replacing ad-hoc creation in scripts.
 * Creating an org and seating its first admin happen in one transaction, so an
 * org is never left with no one able to administer it.
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Normalise a proposed slug and reject anything not URL-safe. */
export function normalizeSlug(input: string): string {
  const slug = input.trim().toLowerCase()
  if (!SLUG_RE.test(slug) || slug.length < 2 || slug.length > 40) {
    throw new ValidationError(
      'Slug must be 2–40 chars: lowercase letters, digits and single hyphens',
    )
  }
  // Reserved words that would collide with app/auth routes.
  if (['api', 'login', 'app', 'admin', 'dashboard', 'static', 'public', '_next'].includes(slug)) {
    throw new ValidationError(`"${slug}" is reserved`)
  }
  return slug
}

/**
 * Create an organization and seat its first admin, atomically.
 *
 * @param adminUserId the user who becomes the org's ADMIN member.
 */
export async function createOrganization(params: {
  name: string
  type: OrgType
  slug: string
  adminUserId: string
  domain?: string | null
}) {
  const slug = normalizeSlug(params.slug)
  const name = params.name.trim()
  if (!name) throw new ValidationError('Name is required')

  try {
    return await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name, type: params.type, slug, domain: normalizeDomain(params.domain) },
      })
      await tx.organizationMember.create({
        data: { userId: params.adminUserId, orgId: org.id, role: 'ADMIN' },
      })
      return org
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ValidationError(`An organization with slug "${slug}" already exists`)
    }
    throw e
  }
}

/** Add an existing user (looked up by email) to an org. */
export async function getOrgBySlug(slug: string) {
  return prisma.organization.findUnique({ where: { slug } })
}

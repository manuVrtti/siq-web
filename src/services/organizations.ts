import 'server-only'

import { ValidationError } from '@/lib/errors'
import { prisma } from '@/lib/prisma'

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

export async function getOrgBySlug(slug: string) {
  return prisma.organization.findUnique({ where: { slug } })
}

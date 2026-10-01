import { type NextRequest } from 'next/server'
import type { Prisma, UserRole } from '@prisma/client'

import { errorResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { XLSX_MIME, buildWorkbook, fileResponse } from '@/lib/import/xlsx-parser'
import { prisma } from '@/lib/prisma'

/**
 * People (same filters as the All people page) as .xlsx. SUPER_ADMIN.
 * Contact details only — never passwords, answers or résumé contents.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ROLES = ['STUDENT', 'COLLEGE_HOD', 'COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const
const MAX_ROWS = 50_000

export async function GET(request: NextRequest) {
  try {
    await withRole(['SUPER_ADMIN'])
    const p = request.nextUrl.searchParams
    const role = ROLES.find((r) => r === p.get('role')) as UserRole | undefined
    const status = p.get('status')
    const orgId = p.get('org') || undefined
    const q = p.get('q')?.trim()
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(orgId && { memberships: { some: { orgId } } }),
      ...(status === 'suspended' && { suspendedAt: { not: null } }),
      ...(status === 'invited' && { firebaseUid: { startsWith: 'pending:' }, suspendedAt: null }),
      ...(status === 'active' && { NOT: { firebaseUid: { startsWith: 'pending:' } }, suspendedAt: null }),
      ...(q && {
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
      }),
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_ROWS,
      select: {
        name: true,
        email: true,
        phone: true,
        role: true,
        firebaseUid: true,
        suspendedAt: true,
        createdAt: true,
        lastLoginAt: true,
        memberships: { select: { org: { select: { name: true } }, department: { select: { code: true } } } },
      },
    })
    const body = buildWorkbook([
      {
        name: 'People',
        widths: [26, 32, 16, 14, 12, 40, 12, 12],
        rows: users.map((u) => ({
          Name: u.name ?? '',
          Email: u.email ?? '',
          Phone: u.phone ?? '',
          Role: u.role.replace('_', ' ').toLowerCase(),
          Status: u.suspendedAt ? 'Suspended' : u.firebaseUid.startsWith('pending:') ? 'Invited' : 'Active',
          Organizations: u.memberships.map((m) => m.org.name + (m.department ? ` (${m.department.code})` : '')).join('; '),
          Joined: u.createdAt.toISOString().slice(0, 10),
          'Last active': u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : '',
        })),
      },
    ])
    return fileResponse(body, `selectiq-people-${new Date().toISOString().slice(0, 10)}.xlsx`, XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}

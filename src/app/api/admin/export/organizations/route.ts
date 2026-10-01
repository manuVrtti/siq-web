import { type NextRequest } from 'next/server'

import { errorResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { XLSX_MIME, buildWorkbook, fileResponse } from '@/lib/import/xlsx-parser'
import { ORG_SORTS, getOrgDirectory, type OrgHealth } from '@/services/console'

/** The organization directory (same filters as the page) as .xlsx. SUPER_ADMIN. */

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HEALTH = ['no-admin', 'no-departments', 'inactive', 'healthy'] as const
const LABEL: Record<OrgHealth, string> = {
  'no-admin': 'No College Admin',
  'no-departments': 'No departments',
  inactive: 'Inactive 30d',
  healthy: 'Healthy',
}

function pick<T extends string>(v: string | null, all: readonly T[]): T | undefined {
  return all.find((x) => x === v)
}

export async function GET(request: NextRequest) {
  try {
    await withRole(['SUPER_ADMIN'])
    const p = request.nextUrl.searchParams
    const { filtered } = await getOrgDirectory({
      q: p.get('q') ?? undefined,
      type: pick(p.get('type'), ['COLLEGE', 'COMPANY'] as const),
      status: pick(p.get('status'), ['ACTIVE', 'SUSPENDED'] as const),
      state: p.get('state') ?? undefined,
      health: pick(p.get('health'), HEALTH),
      sort: pick(p.get('sort'), ORG_SORTS) ?? 'createdAt',
      dir: p.get('dir') === 'asc' ? 'asc' : 'desc',
      take: 100_000,
    })
    const body = buildWorkbook([
      {
        name: 'Organizations',
        widths: [34, 14, 10, 22, 18, 18, 10, 10, 10, 8, 12, 8, 14, 16, 16],
        rows: filtered.map((o) => ({
          Name: o.name,
          Address: `/${o.slug}`,
          Type: o.type === 'COLLEGE' ? 'College' : 'Company',
          'Email domain': o.domain ?? '',
          City: o.city ?? '',
          State: o.state ?? '',
          Status: o.status === 'SUSPENDED' ? 'Suspended' : 'Active',
          Students: o.students,
          'College Admins': o.admins,
          HODs: o.hods,
          Departments: o.departments,
          Tests: o.tests,
          'Submissions (7d)': o.submissions7d,
          'Last activity': o.lastActivity ? o.lastActivity.toISOString().slice(0, 10) : '',
          Health: LABEL[o.health],
        })),
      },
    ])
    return fileResponse(body, `selectiq-organizations-${new Date().toISOString().slice(0, 10)}.xlsx`, XLSX_MIME)
  } catch (error) {
    return errorResponse(error)
  }
}

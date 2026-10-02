import { type NextRequest } from 'next/server'

import { errorResponse, successResponse } from '@/lib/api-response'
import { withRole } from '@/lib/auth/require-role'
import { scopeForDrive } from '@/lib/auth/drive-scope'
import { listRegistrations } from '@/services/mock-drive-registration'
import { getDriveStandings } from '@/services/mock-drive-runtime'

export const dynamic = 'force-dynamic'

const STAFF = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'SUPER_ADMIN'] as const

/** Plan 024 — live monitor: funnel + every registrant's progress. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await withRole(STAFF)
    const { id } = await params
    const scope = await scopeForDrive(user, id)
    const [standings, registrations] = await Promise.all([getDriveStandings(scope, id), listRegistrations(scope, id)])
    return successResponse({ ...standings, students: registrations })
  } catch (error) {
    return errorResponse(error)
  }
}

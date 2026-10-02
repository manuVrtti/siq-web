import { type NextRequest, NextResponse } from 'next/server'

import { refreshAllColleges } from '@/services/competency/refresh'

/**
 * Plan 026 — nightly refresh of every college's batch comparisons and
 * insights. Called by Vercel Cron (vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET configured the
 * route refuses everything — it is never open.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const res = await refreshAllColleges()
  return NextResponse.json({ ok: true, ...res })
}

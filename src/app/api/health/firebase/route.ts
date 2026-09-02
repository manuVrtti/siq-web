import { NextResponse } from 'next/server'

import { getAdminAuth } from '@/lib/firebase-admin'

/**
 * Plan 010 — Firebase Admin readiness.
 *
 * `listUsers(1)` is the cheapest call that proves three things at once: the
 * service-account credentials parse, they are accepted by Google, and
 * Authentication is actually provisioned for the project. A malformed private
 * key and a project with Auth never enabled both fail here — the latter with
 * CONFIGURATION_NOT_FOUND, which is otherwise baffling to diagnose.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()

  try {
    await getAdminAuth().listUsers(1)

    return NextResponse.json({
      status: 'ok',
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[health/firebase] check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Firebase Admin unavailable',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

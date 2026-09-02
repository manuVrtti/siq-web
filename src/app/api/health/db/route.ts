import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

/**
 * Plan 003/010 — database readiness.
 *
 * `latencyMs` is the useful part: a database that answers in 40ms and one that
 * answers in 4000ms are both "ok" to a boolean check, but only one of them is
 * actually healthy.
 *
 * The failure body is deliberately generic — a Prisma connection error string
 * contains the host and user.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()

  try {
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[health/db] check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Database connection failed',
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

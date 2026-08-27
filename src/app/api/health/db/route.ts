import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

/**
 * Database health check — Plan 003.
 *
 * Verifies the Prisma connection to Supabase Postgres is live. Unauthenticated
 * so uptime monitors can reach it, and deliberately silent about the failure
 * detail: a connection error can carry the host and credentials, which must
 * never reach the client.
 */

// Never cache — a cached 200 would mask a database outage.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Cheapest possible round trip that proves the connection works.
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Log server-side only. The response stays generic.
    console.error('[health/db] database check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        message: 'Database connection failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

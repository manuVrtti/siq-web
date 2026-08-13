import { NextResponse } from 'next/server'

/**
 * Health check.
 *
 * Intentionally unauthenticated — it is used by uptime monitors and Vercel
 * deploy checks. It reports process liveness only and must never expose
 * environment, database or build details.
 */

// Never cache: a cached 200 would mask an unhealthy instance.
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
  })
}

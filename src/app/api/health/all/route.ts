import { NextResponse } from 'next/server'

import { getAdminAuth } from '@/lib/firebase-admin'
import { prisma } from '@/lib/prisma'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Plan 010 — aggregate health.
 *
 * The first thing to open when production misbehaves: it says which dependency
 * is at fault instead of making you check four endpoints.
 *
 * Checks run in parallel via `allSettled`, so one hanging service cannot mask
 * the others, and the whole response is bounded by the slowest rather than the
 * sum. Each check is individually timed out — an unreachable host that never
 * refuses the connection would otherwise hang until the platform kills the
 * request.
 */

export const dynamic = 'force-dynamic'

const CHECK_TIMEOUT_MS = 5000

type ServiceStatus = { status: 'ok' | 'error'; latencyMs: number; message?: string }

async function timed(name: string, run: () => Promise<unknown>): Promise<ServiceStatus> {
  const started = Date.now()

  try {
    await Promise.race([
      run(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timed out')), CHECK_TIMEOUT_MS),
      ),
    ])

    return { status: 'ok', latencyMs: Date.now() - started }
  } catch (error) {
    console.error(`[health/all] ${name} failed:`, error)

    return {
      status: 'error',
      latencyMs: Date.now() - started,
      // Generic on purpose — connection errors carry hosts and credentials.
      message: `${name} unavailable`,
    }
  }
}

export async function GET() {
  const [db, firebase, storage] = await Promise.all([
    timed('database', () => prisma.$queryRaw`SELECT 1`),
    timed('firebase', () => getAdminAuth().listUsers(1)),
    // Checks the bucket exists. Listing objects in a missing bucket returns
    // 200 with an empty array, so it would report healthy even unconfigured.
    timed('storage', async () => {
      const { data, error } = await getSupabaseAdmin().storage.listBuckets()
      if (error) throw error
      if (!data.some((b) => b.name === 'avatars')) {
        throw new Error('bucket "avatars" does not exist')
      }
    }),
  ])

  const services = { db, firebase, storage }
  const failing = Object.values(services).filter((s) => s.status === 'error')

  // "degraded" rather than "error" while anything still works — the app may
  // be perfectly usable with storage down, and paging on that would be noise.
  const status = failing.length === 0 ? 'ok' : failing.length === 3 ? 'error' : 'degraded'

  return NextResponse.json(
    { status, services, timestamp: new Date().toISOString() },
    // 200 while degraded: an uptime monitor should not treat a storage outage
    // as the site being down. Only a total failure returns 503.
    { status: status === 'error' ? 503 : 200 },
  )
}

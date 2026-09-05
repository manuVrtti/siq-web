import { NextResponse } from 'next/server'

import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Plan 010 — Supabase Storage readiness.
 *
 * ⚠️  This reports `error` until Plan 009 runs — storage is unconfigured and
 *     the `avatars` bucket does not exist. That is the check working, not the
 *     check being broken; it should go green when Plan 009 lands.
 *
 * Checks that the bucket EXISTS, rather than listing objects inside it.
 * Measured: `.from('any-nonexistent-bucket').list()` returns 200 with an empty
 * array and no error, so an object listing would report healthy whether or not
 * storage had ever been set up — a check that cannot fail is not a check.
 *
 * Listing rather than uploading: proves credentials and reachability without
 * writing anything.
 */

export const dynamic = 'force-dynamic'

const BUCKET = 'avatars'

export async function GET() {
  const started = Date.now()

  try {
    // Throws if SUPABASE_SERVICE_ROLE_KEY is unset.
    const supabase = getSupabaseAdmin()

    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error

    if (!data.some((b) => b.name === BUCKET)) {
      throw new Error(`bucket "${BUCKET}" does not exist`)
    }

    return NextResponse.json({
      status: 'ok',
      bucket: BUCKET,
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[health/storage] check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        // Names the bucket, which is not secret and is the usual cause.
        message: `Storage unavailable (bucket "${BUCKET}")`,
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    )
  }
}

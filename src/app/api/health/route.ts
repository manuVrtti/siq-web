import { NextResponse } from 'next/server'

/**
 * Plan 010 — liveness check.
 *
 * Answers only "is this process up and serving?". It touches no external
 * service on purpose: a load balancer needs to distinguish "the app is dead"
 * from "the database is slow", and a liveness probe that fails on a database
 * blip would take healthy instances out of rotation.
 *
 * Unauthenticated by design. Reports nothing about environment or config.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    uptime: Math.round(process.uptime()),
  })
}

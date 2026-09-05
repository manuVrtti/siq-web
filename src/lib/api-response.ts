import { NextResponse } from 'next/server'

import { AppError } from '@/lib/errors'

/**
 * Plan 010 — one response shape for every API route.
 *
 *   success: { "success": true,  "data": ... }
 *   failure: { "success": false, "error": { "code": ..., "message": ... } }
 *
 * A single envelope means a client can tell success from failure without
 * knowing which endpoint it called, and `code` gives it something stable to
 * branch on.
 *
 * Health endpoints deliberately do NOT use this — Plan 010 specifies their own
 * `{ status, ... }` shape, because uptime monitors and load balancers expect a
 * flat body they can pattern-match without unwrapping.
 */

export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = { success: false; error: { code: string; message: string } }

export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true as const, data }, { status })
}

/**
 * Turns a thrown value into a response.
 *
 * A known `AppError` passes its message and code through. Anything else is
 * logged server-side and returned as a generic 500 — an unexpected error can
 * carry credentials, hostnames or SQL, none of which belong in a response.
 */
export function errorResponse(error: unknown): NextResponse<ApiFailure> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { success: false as const, error: { code: error.code, message: error.message } },
      { status: error.statusCode },
    )
  }

  console.error('[api] unhandled error:', error)

  return NextResponse.json(
    {
      success: false as const,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    },
    { status: 500 },
  )
}

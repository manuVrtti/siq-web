import { NextResponse } from 'next/server'

/**
 * Plan 007 — application error types.
 *
 * Each carries the HTTP status it should produce, so route handlers can throw
 * from anywhere and let one catch block translate. Messages here are safe to
 * show a client; never put internal detail in them.
 */

export class AppError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = new.target.name
    this.status = status
  }
}

/** 401 — not signed in, or the session is invalid. */
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401)
  }
}

/**
 * 403 — signed in, but not allowed.
 *
 * Distinct from AuthError on purpose: 401 tells the client to sign in, 403
 * tells it that signing in again will not help.
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403)
  }
}

/** 400 — the request itself is malformed. */
export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400)
  }
}

/** 404 — no such resource, or the caller may not know it exists. */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404)
  }
}

/**
 * Translates a thrown error into a response.
 *
 * Known `AppError`s pass their message through. Anything else becomes a
 * generic 500 — an unexpected error can contain connection strings, file
 * paths or tokens, none of which belong in a response body.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  console.error('[api] unhandled error:', error)

  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
}

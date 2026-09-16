/**
 * Plan 007/010 — application error types.
 *
 * Each carries the HTTP status it should produce and a stable machine-readable
 * code, so a client can branch on `FORBIDDEN` without string-matching a
 * message that might later be reworded or translated.
 *
 * Messages here are shown to clients. Never put internal detail in them —
 * connection strings, file paths and stack traces belong in the server log.
 */

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR'
  | 'SECURE_BROWSER_REQUIRED'

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode

  constructor(message: string, statusCode = 500, code: ErrorCode = 'INTERNAL_ERROR') {
    super(message)
    this.name = new.target.name
    this.statusCode = statusCode
    this.code = code
  }

  /** Kept for callers written against Plan 007's `status`. */
  get status(): number {
    return this.statusCode
  }
}

/** 401 — not signed in, or the session is invalid. */
export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
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
    super(message, 403, 'FORBIDDEN')
  }
}

/** 400 — the request itself is malformed. */
export class ValidationError extends AppError {
  constructor(message = 'Invalid request') {
    super(message, 400, 'VALIDATION_ERROR')
  }
}

/** 404 — no such resource, or the caller may not know it exists. */
export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND')
  }
}

/**
 * 403 — Plan 017 — request must come from the SelectIQ Secure Browser.
 * Distinct code from ordinary FORBIDDEN so the SEB itself can react (prompt
 * the user to reopen inside the shell) rather than treat it as a permission
 * error.
 */
export class SecureBrowserRequiredError extends AppError {
  constructor(message = 'Secure browser required') {
    super(message, 403, 'SECURE_BROWSER_REQUIRED')
  }
}

// Response helpers live in `@/lib/api-response`; re-exported so the Plan 007
// call sites that import `handleApiError` from here keep working.
export { errorResponse as handleApiError } from '@/lib/api-response'

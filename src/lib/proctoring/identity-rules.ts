/**
 * Plan 018b — identity-match rules shared by the browser (face-identity.ts)
 * and the server (services/identity.ts), so both judge a score the same way.
 */

/** Same person when the face-api descriptor distance is at most this. */
export const MATCH_MAX_DISTANCE = 0.55

/** matchScore = 1 − distance; at or above this it's a match. */
export const MIN_MATCH_SCORE = 1 - MATCH_MAX_DISTANCE

/** Tries a student gets at the pre-exam identity check. */
export const IDENTITY_MAX_ATTEMPTS = 3

/** Random identity re-checks per exam (inclusive range). */
export const RANDOM_CHECKS_MIN = 4
export const RANDOM_CHECKS_MAX = 6

/** Cap on stored random checks per attempt (abuse guard). */
export const MAX_CHECKS_PER_ATTEMPT = 20

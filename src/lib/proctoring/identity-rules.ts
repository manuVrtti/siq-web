/**
 * Plans 018b / 018c — identity-match rules shared by the browser
 * (face-identity.ts) and the server (services/identity.ts), so both judge a
 * score the same way.
 *
 * face-api gives a DISTANCE between two faces (same person ≈ 0.2–0.45,
 * different people ≳ 0.6). Students and staff see a CONFIDENCE instead: a
 * logistic curve centred on the match threshold —
 *   d 0.24 → 99%   d 0.40 → 90%   d 0.55 → 50%   d 0.70 → 10%
 * (018b showed "1 − distance", so a strong match read as 76%.)
 */

/** Same person when the descriptor distance is at most this. */
export const MATCH_MAX_DISTANCE = 0.55

/** Steepness of the confidence curve. */
const CURVE = 0.07

/** Distance → confidence (0–1) that it's the same person. */
export function distanceToConfidence(distance: number): number {
  if (!Number.isFinite(distance)) return 0
  return 1 / (1 + Math.exp((distance - MATCH_MAX_DISTANCE) / CURVE))
}

/** Confidence at or above this is a match (= distance at the threshold). */
export const MIN_MATCH_CONFIDENCE = 0.5

export function isMatchConfidence(confidence: number): boolean {
  return confidence >= MIN_MATCH_CONFIDENCE
}

/** Staff wording. */
export function confidenceBand(confidence: number | null | undefined): 'STRONG' | 'LIKELY' | 'DIFFERENT' | null {
  if (confidence === null || confidence === undefined) return null
  if (confidence >= 0.9) return 'STRONG'
  if (confidence >= MIN_MATCH_CONFIDENCE) return 'LIKELY'
  return 'DIFFERENT'
}

/** Tries a student gets at the pre-exam identity check. */
export const IDENTITY_MAX_ATTEMPTS = 3

/** Random identity re-checks per exam (inclusive range). */
export const RANDOM_CHECKS_MIN = 4
export const RANDOM_CHECKS_MAX = 6

/** Cap on stored random checks per attempt (abuse guard). */
export const MAX_CHECKS_PER_ATTEMPT = 20

/** Photo quality gate (018c). */
export const QUALITY = {
  /** Frames grabbed per check; the best usable one counts. */
  frames: 3,
  frameGapMs: 160,
  minDetectionScore: 0.8,
  /** Face box height as a share of the frame height. */
  minFaceHeight: 0.18,
  /** Mean brightness of the face area, 0–255. */
  minBrightness: 55,
  maxBrightness: 220,
  /** Nose offset from the eye midpoint, as a share of eye distance (head turned). */
  maxYaw: 0.35,
} as const

/**
 * Plan 026 — every number that turns a competency score into a judgement.
 * Deterministic and explainable: any insight can be justified to a student
 * or HOD from these constants alone. Tune here, nowhere else.
 */

/** Cumulative profiles use this scopeRefId (see services/competency/rollup.ts). */
export const CUMULATIVE_REF = 'ALL'

/** Score (0–100, difficulty-weighted) → tier. Lower bound inclusive. */
export const TIER_BOUNDS = { NEEDS_WORK: 40, ON_TRACK: 60, STRONG: 80 } as const

/** Below this a dimension is "weak" in absolute terms. */
export const ABSOLUTE_WEAK_BELOW = TIER_BOUNDS.ON_TRACK

/** Fewer graded questions than this → shown, but never ranked as a priority. */
export const MIN_EVIDENCE = 2

/** Trend: compare the latest test with the average of up to TREND_WINDOW-1 earlier ones. */
export const TREND_WINDOW = 5
export const TREND_MIN_SNAPSHOTS = 2
export const TREND_MIN_DELTA = 5

/**
 * How foundational a platform topic is for placements. A gap in DSA hurts
 * more than one in Verbal, so it ranks higher. College-added topics: 1.
 */
export const FOUNDATIONAL_WEIGHT: Record<string, number> = {
  DSA: 1.3,
  CODING: 1.25,
  APT: 1.2,
  DBMS: 1.1,
  OS: 1.1,
  CN: 1.1,
  OOP: 1.1,
  LR: 1.1,
  VERBAL: 1,
}

/** Priority multipliers. */
export const SEVERITY = { CRITICAL_GAP: 2, NEEDS_WORK: 1, COHORT_ONLY: 0.5 } as const
export const BELOW_COHORT_BOOST = 1.5
export const DECLINING_BOOST = 1.25

/** Unranked dimensions sort last. */
export const UNRANKED = 999

/** Recommendations kept per student. */
export const MAX_RECOMMENDATIONS = 10

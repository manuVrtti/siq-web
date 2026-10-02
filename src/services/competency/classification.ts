import type { CompetencyTier, CompetencyTrend } from '@prisma/client'

import {
  ABSOLUTE_WEAK_BELOW,
  BELOW_COHORT_BOOST,
  DECLINING_BOOST,
  FOUNDATIONAL_WEIGHT,
  SEVERITY,
  TIER_BOUNDS,
  TREND_MIN_DELTA,
  TREND_MIN_SNAPSHOTS,
  TREND_WINDOW,
} from '@/constants/competency-thresholds'

/**
 * Plan 026 — pure classification rules (no I/O). See
 * constants/competency-thresholds.ts for every number used here.
 */

export function classifyTier(score: number): CompetencyTier {
  if (score >= TIER_BOUNDS.STRONG) return 'STRONG'
  if (score >= TIER_BOUNDS.ON_TRACK) return 'ON_TRACK'
  if (score >= TIER_BOUNDS.NEEDS_WORK) return 'NEEDS_WORK'
  return 'CRITICAL_GAP'
}

export function evaluateDimension(score: number, baseline: { p25: number } | null) {
  return {
    belowAbsolute: score < ABSOLUTE_WEAK_BELOW,
    belowCohort: baseline !== null && score < baseline.p25,
  }
}

/**
 * Chronological per-test scores → trend. The latest test against the mean of
 * the earlier ones in the window; a move of TREND_MIN_DELTA points or more
 * counts.
 */
export function detectTrend(chronological: number[]): CompetencyTrend {
  const window = chronological.slice(-TREND_WINDOW)
  if (window.length < TREND_MIN_SNAPSHOTS) return 'INSUFFICIENT_DATA'
  const last = window[window.length - 1]!
  const earlier = window.slice(0, -1)
  const mean = earlier.reduce((a, b) => a + b, 0) / earlier.length
  const delta = last - mean
  if (delta >= TREND_MIN_DELTA) return 'IMPROVING'
  if (delta <= -TREND_MIN_DELTA) return 'DECLINING'
  return 'STABLE'
}

/**
 * How urgently to fix a dimension; 0 when it isn't weak at all.
 *   severity (critical 2 · needs work 1 · only below cohort 0.5)
 *   × foundational weight of its topic
 *   × 1.5 when also below the cohort's bottom quartile
 *   × 1.25 when declining
 *   + a small tie-break: the lower the score, the sooner.
 */
export function priorityScore(input: {
  score: number
  tier: CompetencyTier
  belowCohort: boolean
  trend: CompetencyTrend
  topicCode: string | null
}): number {
  const severity =
    input.tier === 'CRITICAL_GAP'
      ? SEVERITY.CRITICAL_GAP
      : input.tier === 'NEEDS_WORK'
        ? SEVERITY.NEEDS_WORK
        : input.belowCohort
          ? SEVERITY.COHORT_ONLY
          : 0
  if (severity === 0) return 0
  const foundational = (input.topicCode && FOUNDATIONAL_WEIGHT[input.topicCode]) || 1
  return (
    severity *
      foundational *
      (input.belowCohort ? BELOW_COHORT_BOOST : 1) *
      (input.trend === 'DECLINING' ? DECLINING_BOOST : 1) +
    (100 - input.score) / 1000
  )
}

export const TIER_LABEL: Record<CompetencyTier, string> = {
  CRITICAL_GAP: 'Critical gap',
  NEEDS_WORK: 'Needs work',
  ON_TRACK: 'On track',
  STRONG: 'Strong',
}

export const TREND_LABEL: Record<CompetencyTrend, string> = {
  IMPROVING: 'Improving',
  STABLE: 'Steady',
  DECLINING: 'Slipping',
  INSUFFICIENT_DATA: 'Not enough tests yet',
}

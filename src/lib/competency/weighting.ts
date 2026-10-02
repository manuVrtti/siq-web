/**
 * Plan 025 — how one graded answer counts toward a competency score.
 *
 * Pure functions, no I/O, so the maths can be checked by hand.
 *
 *   credit   = scoreAwarded / maxMarks, clamped to 0…1. Negative marking
 *              lowers marks, never competency below zero; partial credit from
 *              a reviewed subjective answer counts proportionally.
 *   weight   = by difficulty: a HARD question carries twice the signal of an
 *              EASY one.
 *
 *   rawAccuracy   = Σ credit / n × 100
 *   weightedScore = Σ (weight × credit) / Σ weight × 100   ← the headline score
 *
 * Unanswered questions count as attempted with zero credit — skipping is a
 * signal too.
 */

export const DIFFICULTY_WEIGHT = { EASY: 1, MEDIUM: 1.5, HARD: 2 } as const
export type Difficulty = keyof typeof DIFFICULTY_WEIGHT

export type GradedItem = {
  difficulty: Difficulty
  scoreAwarded: number
  maxMarks: number
}

export function creditOf(item: Pick<GradedItem, 'scoreAwarded' | 'maxMarks'>): number {
  if (!(item.maxMarks > 0)) return 0
  return Math.min(1, Math.max(0, item.scoreAwarded / item.maxMarks))
}

export type Rollup = {
  questionsAttempted: number
  questionsCorrect: number
  rawAccuracy: number
  weightedScore: number
  marksEarned: number
  marksPossible: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function rollup(items: GradedItem[]): Rollup {
  let credit = 0
  let weighted = 0
  let weights = 0
  let correct = 0
  let earned = 0
  let possible = 0
  for (const it of items) {
    const c = creditOf(it)
    const w = DIFFICULTY_WEIGHT[it.difficulty] ?? 1
    credit += c
    weighted += w * c
    weights += w
    if (c >= 1) correct++
    earned += it.scoreAwarded
    possible += it.maxMarks
  }
  const n = items.length
  return {
    questionsAttempted: n,
    questionsCorrect: correct,
    rawAccuracy: n ? round2((credit / n) * 100) : 0,
    weightedScore: weights ? round2((weighted / weights) * 100) : 0,
    marksEarned: round2(earned),
    marksPossible: round2(possible),
  }
}

/** Linear-interpolated percentile of an ascending-sorted array (p in 0…1). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return round2(sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo))
}

export function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0
  return {
    avgAccuracy: round2(avg),
    medianAccuracy: percentile(sorted, 0.5),
    p25Accuracy: percentile(sorted, 0.25),
    p75Accuracy: percentile(sorted, 0.75),
    sampleSize: sorted.length,
  }
}

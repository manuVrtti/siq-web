/**
 * Plan 019 — pure statistics helpers for analytics. No I/O, so every metric
 * definition lives in one place and can be checked by hand.
 */

export function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!
}

/** Population standard deviation. */
export function stdDev(values: number[]): number | null {
  const m = mean(values)
  if (m === null) return null
  return Math.sqrt(values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length)
}

export type HistogramBucket = { label: string; from: number; to: number; count: number }

/**
 * Ten 10-point buckets over 0–100%. The last bucket is closed (90–100
 * inclusive) so a perfect score lands somewhere.
 */
export function percentageHistogram(percentages: number[]): HistogramBucket[] {
  const buckets: HistogramBucket[] = Array.from({ length: 10 }, (_, i) => ({
    label: `${i * 10}–${i * 10 + 10}`,
    from: i * 10,
    to: i * 10 + 10,
    count: 0,
  }))
  for (const p of percentages) {
    const clamped = Math.min(100, Math.max(0, p))
    const idx = Math.min(9, Math.floor(clamped / 10))
    buckets[idx]!.count += 1
  }
  return buckets
}

/**
 * Point-biserial correlation between an item score (0–1, usually 0 or 1)
 * and the candidate's total percentage. The classic item-discrimination
 * index: > 0.3 good, 0.1–0.3 fair, < 0.1 poor, negative = the question is
 * answered better by weaker candidates (usually a bad key or ambiguity).
 *
 * Computed as a Pearson correlation, which reduces to point-biserial when
 * the item is dichotomous and still behaves for partial-credit items.
 * Returns null with fewer than 5 pairs or zero variance — too little signal.
 */
export function pointBiserial(pairs: { item: number; total: number }[]): number | null {
  if (pairs.length < 5) return null
  const mi = mean(pairs.map((p) => p.item))!
  const mt = mean(pairs.map((p) => p.total))!
  let cov = 0
  let vi = 0
  let vt = 0
  for (const p of pairs) {
    const di = p.item - mi
    const dt = p.total - mt
    cov += di * dt
    vi += di * di
    vt += dt * dt
  }
  if (vi === 0 || vt === 0) return null
  return cov / Math.sqrt(vi * vt)
}

/** Round to n decimals without float noise in the UI. */
export function round(value: number | null, digits = 1): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const f = 10 ** digits
  return Math.round(value * f) / f
}

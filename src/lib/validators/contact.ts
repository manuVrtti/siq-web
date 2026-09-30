/**
 * Contact normalisation shared by the paste import (plan 013) and the
 * spreadsheet import (plan 020), so both accept and reject the same values.
 *
 * Deliberately generous — colleges' rosters use varied formats. Real
 * delivery validation happens later (Firebase, MSG91).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// E.164 in the loose sense.
const PHONE_RE = /^\+?[1-9]\d{9,14}$/

/** Lowercased email, or null if it doesn't look like one. */
export function normalizeEmail(raw: string): string | null {
  const v = raw.trim().toLowerCase()
  return EMAIL_RE.test(v) ? v : null
}

/**
 * E.164-ish phone, or null. A bare 10-digit number is assumed Indian (+91).
 * Spaces, dashes and brackets are stripped; a leading "0" trunk prefix on an
 * 11-digit Indian number is dropped. Spreadsheets often store phones as
 * numbers, so numeric input is accepted too.
 */
export function normalizePhone(raw: string | number): string | null {
  let v = String(raw).trim().replace(/[\s\-()]/g, '')
  if (/^0\d{10}$/.test(v)) v = v.slice(1)
  if (/^\d{10}$/.test(v)) v = `+91${v}`
  if (/^91\d{10}$/.test(v)) v = `+${v}`
  return PHONE_RE.test(v) ? (v.startsWith('+') ? v : `+${v}`) : null
}

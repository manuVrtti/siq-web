import 'server-only'

import { randomUUID } from 'node:crypto'

import { prisma } from '@/lib/prisma'
import { buildWorkbook, parseSheet } from '@/lib/import/xlsx-parser'
import { normalizeEmail, normalizePhone } from '@/lib/validators/contact'

/**
 * Plan 020 — candidate roster import from a spreadsheet:
 * template → validate (dry run) → commit.
 *
 * Unlike the paste import (plan 013), each ROW is one person, so a row with
 * both an email and a phone creates one account, not two. Rows may carry a
 * name and a batch; batches are created on demand.
 *
 * Commit is batched: a fixed number of queries regardless of file size
 * (createMany + skipDuplicates), so a 2,000-row roster finishes well inside a
 * serverless timeout. The paste import did 2 sequential queries per row.
 */

export const CANDIDATE_REQUIRED_HEADERS = ['name', 'email', 'phone']

type Existing = { id: string; email: string | null; phone: string | null; name: string | null; role: string }

export type CandidateRowResult =
  | {
      rowNumber: number
      ok: true
      name: string | null
      email: string | null
      phone: string | null
      batch: string | null
      /** 'new' = account will be created; 'existing' = already has an account (joins the org). */
      status: 'new' | 'existing'
      existingId?: string
    }
  | { rowNumber: number; ok: false; name: string | null; label: string; errors: string[] }

export function getCandidateTemplate(): Buffer {
  return buildWorkbook([
    {
      name: 'Candidates',
      widths: [26, 32, 16, 22],
      rows: [
        { name: 'Aarav Sharma', email: 'aarav.sharma@college.edu', phone: '9876543210', batch: 'CSE 2026 - A' },
        { name: 'Diya Patel', email: 'diya.patel@college.edu', phone: '', batch: 'CSE 2026 - A' },
        { name: 'Kabir Singh', email: '', phone: '+91 98765 43211', batch: 'ECE 2026' },
      ],
    },
    {
      name: 'Instructions',
      widths: [12, 100],
      rows: [
        { column: 'name', rule: 'Full name. Optional, but recommended — it appears on results and reports.' },
        { column: 'email', rule: 'The email the candidate will sign in with (Google). Needs email OR phone.' },
        { column: 'phone', rule: '10-digit Indian numbers are assumed +91. Needs email OR phone.' },
        { column: 'batch', rule: 'Optional batch name, e.g. "CSE 2026 - A". Created if it does not exist.' },
        { column: 'Accounts', rule: 'Candidates sign in with the same email/phone to claim their account. Existing accounts are linked, not duplicated.' },
        { column: 'Limits', rule: 'Up to 2,000 rows and 5 MB per file. Only the first sheet is read.' },
      ],
    },
  ])
}

export async function validateCandidateImport(orgId: string, bytes: ArrayBuffer | Buffer) {
  const { rows } = parseSheet(bytes, { requiredHeaders: CANDIDATE_REQUIRED_HEADERS })

  // Normalise every row first so the DB lookup is one query.
  const norm = rows.map((r) => {
    const rawEmail = r.values.email ?? ''
    const rawPhone = r.values.phone ?? ''
    return {
      rowNumber: r.rowNumber,
      name: (r.values.name ?? '').slice(0, 200) || null,
      batch: (r.values.batch ?? '').slice(0, 100) || null,
      rawEmail,
      rawPhone,
      email: rawEmail ? normalizeEmail(rawEmail) : null,
      phone: rawPhone ? normalizePhone(rawPhone) : null,
    }
  })

  const emails = [...new Set(norm.map((n) => n.email).filter((e): e is string => Boolean(e)))]
  const phones = [...new Set(norm.map((n) => n.phone).filter((p): p is string => Boolean(p)))]
  const existing: Existing[] =
    emails.length || phones.length
      ? await prisma.user.findMany({
          where: { OR: [{ email: { in: emails } }, { phone: { in: phones } }] },
          select: { id: true, email: true, phone: true, name: true, role: true },
        })
      : []
  const byEmail = new Map(existing.filter((u) => u.email).map((u) => [u.email!, u]))
  const byPhone = new Map(existing.filter((u) => u.phone).map((u) => [u.phone!, u]))

  const seenEmail = new Map<string, number>()
  const seenPhone = new Map<string, number>()

  const results: CandidateRowResult[] = norm.map((n) => {
    const errors: string[] = []
    const label = n.name ?? n.rawEmail ?? n.rawPhone ?? `Row ${n.rowNumber}`

    if (n.rawEmail && !n.email) errors.push(`"${n.rawEmail}" is not a valid email`)
    if (n.rawPhone && !n.phone) errors.push(`"${n.rawPhone}" is not a valid phone number`)
    if (!n.rawEmail && !n.rawPhone) errors.push('Needs an email or a phone number')

    if (n.email && seenEmail.has(n.email)) errors.push(`Same email as row ${seenEmail.get(n.email)}`)
    if (n.phone && seenPhone.has(n.phone)) errors.push(`Same phone as row ${seenPhone.get(n.phone)}`)
    if (n.email) seenEmail.set(n.email, n.rowNumber)
    if (n.phone) seenPhone.set(n.phone, n.rowNumber)

    const matchE = n.email ? byEmail.get(n.email) : undefined
    const matchP = n.phone ? byPhone.get(n.phone) : undefined
    if (matchE && matchP && matchE.id !== matchP.id) {
      errors.push('This email and phone belong to two different existing accounts')
    }
    const match = matchE ?? matchP
    if (match && match.role !== 'STUDENT') {
      errors.push('This email/phone belongs to a staff account, not a candidate')
    }

    if (errors.length) return { rowNumber: n.rowNumber, ok: false, name: n.name, label, errors }
    return {
      rowNumber: n.rowNumber,
      ok: true,
      name: n.name,
      email: n.email,
      phone: n.phone,
      batch: n.batch,
      status: match ? 'existing' : 'new',
      existingId: match?.id,
    }
  })

  const valid = results.filter((r): r is Extract<CandidateRowResult, { ok: true }> => r.ok)
  const batchNames = [...new Set(valid.map((r) => r.batch).filter((b): b is string => Boolean(b)))]
  const existingBatches = batchNames.length
    ? await prisma.batch.findMany({ where: { orgId, name: { in: batchNames } }, select: { name: true } })
    : []
  const existingBatchSet = new Set(existingBatches.map((b) => b.name))

  return {
    rows: results,
    summary: {
      total: results.length,
      valid: valid.length,
      invalid: results.length - valid.length,
      newAccounts: valid.filter((r) => r.status === 'new').length,
      existingAccounts: valid.filter((r) => r.status === 'existing').length,
      newBatches: batchNames.filter((b) => !existingBatchSet.has(b)),
    },
  }
}

export async function commitCandidateImport(orgId: string, bytes: ArrayBuffer | Buffer) {
  const { rows, summary } = await validateCandidateImport(orgId, bytes)
  const valid = rows.filter((r): r is Extract<CandidateRowResult, { ok: true }> => r.ok)
  if (valid.length === 0) return { created: 0, linked: 0, skipped: summary.invalid, batchesCreated: 0 }

  return prisma.$transaction(
    async (tx) => {
      // 1. New accounts (pending until the candidate signs in and claims).
      const fresh = valid.filter((r) => r.status === 'new')
      if (fresh.length) {
        await tx.user.createMany({
          data: fresh.map((r) => ({
            email: r.email,
            phone: r.phone,
            name: r.name,
            firebaseUid: `pending:${randomUUID()}`,
            role: 'STUDENT' as const,
          })),
          skipDuplicates: true,
        })
      }

      // 2. Resolve every row to a user id (new + existing) in one query.
      const emails = valid.map((r) => r.email).filter((e): e is string => Boolean(e))
      const phones = valid.map((r) => r.phone).filter((p): p is string => Boolean(p))
      const users = await tx.user.findMany({
        where: { OR: [{ email: { in: emails } }, { phone: { in: phones } }] },
        select: { id: true, email: true, phone: true, name: true },
      })
      const idByEmail = new Map(users.filter((u) => u.email).map((u) => [u.email!, u.id]))
      const idByPhone = new Map(users.filter((u) => u.phone).map((u) => [u.phone!, u.id]))
      const rowUser = valid
        .map((r) => ({ r, id: (r.email && idByEmail.get(r.email)) || (r.phone && idByPhone.get(r.phone)) || null }))
        .filter((x): x is { r: (typeof valid)[number]; id: string } => Boolean(x.id))

      // Fill a missing name on existing accounts — never overwrite one.
      const nameless = users.filter((u) => !u.name)
      for (const u of nameless) {
        const row = rowUser.find((x) => x.id === u.id)?.r
        if (row?.name) await tx.user.update({ where: { id: u.id }, data: { name: row.name } })
      }

      // 3. Org memberships.
      const before = await tx.organizationMember.count({ where: { orgId, userId: { in: rowUser.map((x) => x.id) } } })
      await tx.organizationMember.createMany({
        data: [...new Set(rowUser.map((x) => x.id))].map((userId) => ({ orgId, userId })),
        skipDuplicates: true,
      })

      // 4. Batches (create missing, then attach members).
      const batchNames = [...new Set(rowUser.map((x) => x.r.batch).filter((b): b is string => Boolean(b)))]
      let batchesCreated = 0
      if (batchNames.length) {
        const made = await tx.batch.createMany({
          data: batchNames.map((name) => ({ orgId, name })),
          skipDuplicates: true,
        })
        batchesCreated = made.count
        const batches = await tx.batch.findMany({
          where: { orgId, name: { in: batchNames } },
          select: { id: true, name: true },
        })
        const batchId = new Map(batches.map((b) => [b.name, b.id]))
        await tx.batchMember.createMany({
          data: rowUser
            .filter((x) => x.r.batch && batchId.has(x.r.batch))
            .map((x) => ({ batchId: batchId.get(x.r.batch!)!, userId: x.id })),
          skipDuplicates: true,
        })
      }

      return {
        created: fresh.length,
        linked: valid.length - fresh.length,
        joinedOrg: rowUser.length - before,
        skipped: summary.invalid,
        batchesCreated,
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  )
}

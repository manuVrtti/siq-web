import 'server-only'

import { randomUUID } from 'node:crypto'

import { batchWhere, resolveOwningDepartment, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { buildWorkbook, parseSheet } from '@/lib/import/xlsx-parser'
import { normalizeEmail, normalizePhone } from '@/lib/validators/contact'

/**
 * Plan 020 — candidate roster import from a spreadsheet:
 * template → validate (dry run) → commit.
 *
 * Unlike the paste import (plan 013), each ROW is one person, so a row with
 * both an email and a phone creates one account, not two. Rows may carry a
 * name, a batch and a department; batches are created on demand.
 *
 * Departments: a row's `department` (code or name) wins, else the default
 * chosen in the wizard. HOD imports may only use their own departments, may
 * not pull in a student who already belongs to another department, and may
 * not add to another department's batch.
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
      departmentId: string | null
      departmentCode: string | null
      /** 'new' = account will be created; 'existing' = already has an account (joins the org). */
      status: 'new' | 'existing'
      existingId?: string
    }
  | { rowNumber: number; ok: false; name: string | null; label: string; errors: string[] }

export function getCandidateTemplate(): Buffer {
  return buildWorkbook([
    {
      name: 'Candidates',
      widths: [26, 32, 16, 22, 14],
      rows: [
        { name: 'Aarav Sharma', email: 'aarav.sharma@college.edu', phone: '9876543210', batch: 'CSE 2026 - A', department: 'CSE' },
        { name: 'Diya Patel', email: 'diya.patel@college.edu', phone: '', batch: 'CSE 2026 - A', department: 'CSE' },
        { name: 'Kabir Singh', email: '', phone: '+91 98765 43211', batch: 'ECE 2026', department: 'ECE' },
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
        { column: 'department', rule: 'Optional department code or name, e.g. "CSE". Must already exist in Settings → Departments. Empty = the department chosen in the import wizard.' },
        { column: 'Accounts', rule: 'Candidates sign in with the same email/phone to claim their account. Existing accounts are linked, not duplicated.' },
        { column: 'Limits', rule: 'Up to 2,000 rows and 5 MB per file. Only the first sheet is read.' },
      ],
    },
  ])
}

export async function validateCandidateImport(scope: Scope, bytes: ArrayBuffer | Buffer, defaultDepartmentId: string | null = null) {
  const orgId = scope.orgId
  const { rows } = parseSheet(bytes, { requiredHeaders: CANDIDATE_REQUIRED_HEADERS })
  // HODs always import into one of their departments; admins may leave it empty.
  const fallbackDept = await resolveOwningDepartment(scope, defaultDepartmentId)
  const departments = await prisma.department.findMany({ where: { orgId }, select: { id: true, code: true, name: true } })
  const deptByKey = new Map<string, { id: string; code: string }>()
  for (const d of departments) {
    deptByKey.set(d.code.toLowerCase(), d)
    deptByKey.set(d.name.toLowerCase(), d)
  }
  const codeById = new Map(departments.map((d) => [d.id, d.code]))

  // Normalise every row first so the DB lookup is one query.
  const norm = rows.map((r) => {
    const rawEmail = r.values.email ?? ''
    const rawPhone = r.values.phone ?? ''
    return {
      rowNumber: r.rowNumber,
      name: (r.values.name ?? '').slice(0, 200) || null,
      batch: (r.values.batch ?? '').slice(0, 100) || null,
      rawDept: (r.values.department ?? '').trim(),
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
  // Existing members' current department here, so an HOD can't take over another department's student.
  const memberships = existing.length
    ? await prisma.organizationMember.findMany({
        where: { orgId, userId: { in: existing.map((u) => u.id) } },
        select: { userId: true, departmentId: true },
      })
    : []
  const deptOfMember = new Map(memberships.map((m) => [m.userId, m.departmentId]))
  // Batches the scope may NOT use (another department's).
  const rowBatchNames = [...new Set(norm.map((n) => n.batch).filter((b): b is string => Boolean(b)))]
  const foreignBatches = new Set(
    !scope.all && rowBatchNames.length
      ? (
          await prisma.batch.findMany({
            where: { orgId, name: { in: rowBatchNames }, NOT: batchWhere(scope) },
            select: { name: true },
          })
        ).map((b) => b.name)
      : [],
  )

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

    let deptId = fallbackDept
    if (n.rawDept) {
      const d = deptByKey.get(n.rawDept.toLowerCase())
      if (!d) errors.push(`Unknown department "${n.rawDept}" — add it in Settings → Departments first`)
      else deptId = d.id
    }
    if (!scope.all && deptId && !scope.departmentIds.includes(deptId)) {
      errors.push(`${codeById.get(deptId) ?? 'That department'} isn’t one of your departments`)
    }
    if (!scope.all && match && deptOfMember.has(match.id)) {
      const current = deptOfMember.get(match.id)
      if (current && !scope.departmentIds.includes(current)) {
        errors.push(`Already in ${codeById.get(current) ?? 'another department'} — ask your College Admin to move them`)
      }
    }
    if (n.batch && foreignBatches.has(n.batch)) errors.push(`Batch "${n.batch}" belongs to another department`)

    if (errors.length) return { rowNumber: n.rowNumber, ok: false, name: n.name, label, errors }
    return {
      rowNumber: n.rowNumber,
      ok: true,
      name: n.name,
      email: n.email,
      phone: n.phone,
      batch: n.batch,
      departmentId: deptId,
      departmentCode: deptId ? (codeById.get(deptId) ?? null) : null,
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

export async function commitCandidateImport(scope: Scope, bytes: ArrayBuffer | Buffer, defaultDepartmentId: string | null = null) {
  const orgId = scope.orgId
  const { rows, summary } = await validateCandidateImport(scope, bytes, defaultDepartmentId)
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
      const seenUser = new Set<string>()
      await tx.organizationMember.createMany({
        data: rowUser
          .filter((x) => (seenUser.has(x.id) ? false : (seenUser.add(x.id), true)))
          .map((x) => ({ orgId, userId: x.id, departmentId: x.r.departmentId })),
        skipDuplicates: true,
      })
      // Existing members without a department get the row's; never moved out of one.
      const byDept = new Map<string, string[]>()
      for (const x of rowUser) {
        if (!x.r.departmentId) continue
        byDept.set(x.r.departmentId, [...(byDept.get(x.r.departmentId) ?? []), x.id])
      }
      for (const [departmentId, userIds] of byDept) {
        await tx.organizationMember.updateMany({
          where: { orgId, userId: { in: userIds }, departmentId: null },
          data: { departmentId },
        })
      }

      // 4. Batches (create missing, then attach members).
      const batchNames = [...new Set(rowUser.map((x) => x.r.batch).filter((b): b is string => Boolean(b)))]
      let batchesCreated = 0
      if (batchNames.length) {
        // A new batch belongs to the department of its first row (HOD batches always do).
        const deptForBatch = new Map<string, string | null>()
        for (const x of rowUser) if (x.r.batch && !deptForBatch.has(x.r.batch)) deptForBatch.set(x.r.batch, x.r.departmentId)
        const made = await tx.batch.createMany({
          data: batchNames.map((name) => ({ orgId, name, departmentId: deptForBatch.get(name) ?? null })),
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

/**
 * Development database tool — keeps development OFF the production database.
 *
 *   npm run db:which              which Supabase project your local env points at (no secrets printed)
 *   npm run db:setup-dev          migrate + buckets + demo data on the DEV project
 *   npm run db:setup-dev -- --super-admin you@gmail.com
 *                                 …and pre-create your account as Super Admin there
 *
 * SAFETY: `setup-dev` refuses to run if any configured URL points at the
 * production Supabase project. Production is only ever migrated by the
 * Vercel production build (scripts/vercel-build.mjs).
 *
 * Reads .env (DATABASE_URL / DIRECT_URL — the Prisma CLI's file) and
 * .env.local (Supabase URL / keys) via Next's own env loader. It never
 * writes either file.
 */

import { execSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'

import nextEnv from '@next/env'

nextEnv.loadEnvConfig(process.cwd(), true)

/** The live production project. Its ref is public (it's in the browser bundle). */
const PROD_REF = 'ujuywjvrhianxoyfebcw'

function refOf(url) {
  if (!url) return null
  const m = url.match(/([a-z0-9]{20})\.supabase\.co/) ?? url.match(/postgres\.([a-z0-9]{20})[:@]/)
  return m ? m[1] : 'unknown'
}

const refs = {
  DATABASE_URL: refOf(process.env.DATABASE_URL),
  DIRECT_URL: refOf(process.env.DIRECT_URL),
  NEXT_PUBLIC_SUPABASE_URL: refOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
}
const label = (ref) => (!ref ? 'not set' : ref === PROD_REF ? `${ref}  ← PRODUCTION` : `${ref}  (development)`)

const cmd = process.argv[2]

if (cmd === 'which') {
  console.log('Your local environment points at:')
  for (const [k, v] of Object.entries(refs)) console.log(`  ${k.padEnd(26)} ${label(v)}`)
  const unique = new Set(Object.values(refs).filter(Boolean))
  if (unique.size > 1) console.log('\n⚠  These point at DIFFERENT projects — the database and storage must match.')
  if ([...unique].includes(PROD_REF)) console.log('\n⚠  You are developing against PRODUCTION. Run the steps in docs/environments.md.')
  process.exit(0)
}

if (cmd !== 'setup') {
  console.log('Usage: node scripts/dev-db.mjs which | setup [--super-admin email]')
  process.exit(1)
}

// ---- setup (development only) ----------------------------------------------
const bad = Object.entries(refs).filter(([, v]) => v === PROD_REF || v === null)
if (bad.length) {
  console.error('Refusing to set up: these are unset or point at PRODUCTION:')
  for (const [k, v] of bad) console.error(`  ${k} → ${label(v)}`)
  console.error('\nCreate a separate Supabase project for development first (docs/environments.md).')
  process.exit(1)
}

const run = (c) => {
  console.log(`\n$ ${c}`)
  execSync(c, { stdio: 'inherit' })
}

run('npx prisma migrate deploy')
run('node scripts/create-storage-buckets.mjs')

const { PrismaClient } = await import('@prisma/client')
const prisma = new PrismaClient()
const pending = () => `pending:${randomUUID()}`
const superIdx = process.argv.indexOf('--super-admin')
const superEmail = superIdx > 0 ? process.argv[superIdx + 1]?.trim().toLowerCase() : null

try {
  if (superEmail) {
    // Pre-created as pending: your first Google sign-in claims it with this role.
    await prisma.user.upsert({
      where: { email: superEmail },
      create: { email: superEmail, firebaseUid: pending(), role: 'SUPER_ADMIN', onboardedAt: new Date() },
      update: { role: 'SUPER_ADMIN' },
    })
    console.log(`\n✓ ${superEmail} is a Super Admin in the dev database`)
  }

  if (await prisma.organization.findUnique({ where: { slug: 'demo' } })) {
    console.log('✓ Demo college already exists — leaving it as is')
  } else {
    const org = await prisma.organization.create({
      data: {
        name: 'Demo Institute of Technology',
        slug: 'demo',
        type: 'COLLEGE',
        city: 'Noida',
        state: 'Uttar Pradesh',
        departments: {
          create: [
            { code: 'CSE', name: 'Computer Science & Engineering' },
            { code: 'IT', name: 'Information Technology' },
            { code: 'ECE', name: 'Electronics & Communication Engineering' },
          ],
        },
      },
      include: { departments: true },
    })
    const dept = Object.fromEntries(org.departments.map((d) => [d.code, d.id]))
    const admin = await prisma.user.create({
      data: { email: 'demo.admin@example.com', name: 'Demo College Admin', firebaseUid: pending(), role: 'COLLEGE_ADMIN', memberships: { create: { orgId: org.id, role: 'ADMIN' } } },
    })
    await prisma.user.create({
      data: {
        email: 'demo.hod.cse@example.com',
        name: 'Dr. Demo (HOD CSE)',
        firebaseUid: pending(),
        role: 'COLLEGE_HOD',
        memberships: { create: { orgId: org.id } },
        headOf: { create: { departmentId: dept.CSE } },
      },
    })
    const first = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Ananya', 'Vihaan', 'Isha', 'Arjun', 'Sara']
    const last = ['Sharma', 'Patel', 'Singh', 'Nair', 'Gupta', 'Iyer', 'Khan', 'Reddy', 'Das', 'Joshi']
    let n = 0
    for (const code of ['CSE', 'IT', 'ECE']) {
      for (let i = 0; i < 10; i++, n++) {
        await prisma.user.create({
          data: {
            email: `demo.student${n + 1}@example.com`,
            name: `${first[i]} ${last[(i + n) % 10]}`,
            firebaseUid: pending(),
            role: 'STUDENT',
            memberships: { create: { orgId: org.id, departmentId: dept[code] } },
          },
        })
      }
    }
    await prisma.assessment.create({
      data: { orgId: org.id, title: 'Aptitude Practice (demo)', durationMinutes: 30, createdById: admin.id, departmentId: null },
    })
    console.log(`✓ Demo college "/demo": 3 departments, 1 College Admin, 1 HOD, ${n} students, 1 draft test`)
  }
  console.log('\nDev database ready. Sign in locally; nothing here touches production.')
} finally {
  await prisma.$disconnect()
}

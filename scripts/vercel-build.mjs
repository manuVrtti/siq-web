/**
 * Vercel build orchestrator.
 *
 * Runs on every Vercel deploy. The important rule it enforces:
 *
 *   MIGRATIONS RUN ON PRODUCTION DEPLOYS ONLY.
 *
 * `prisma migrate deploy` mutates whatever database DATABASE_URL points at. If
 * it ran on every build, a preview deploy of a feature branch would migrate
 * that branch's database — and until each environment has its own database,
 * that database is production. A half-finished or destructive migration on a
 * branch would then hit real data. So migrations are gated on VERCEL_ENV.
 *
 * Vercel sets VERCEL_ENV to "production" | "preview" | "development".
 *   - production : the deploy of the production branch (main)
 *   - preview    : every other branch / PR deploy
 *
 * Locally VERCEL_ENV is unset, so migrations never run from a laptop build.
 * Use `npm run db:migrate` for local schema changes.
 */

import { execSync } from 'node:child_process'

const env = process.env.VERCEL_ENV ?? 'local'

function run(cmd) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

console.log(`[vercel-build] VERCEL_ENV=${env}`)

// The generated client is needed in every environment.
run('prisma generate')

if (env === 'production') {
  console.log('[vercel-build] production deploy — applying migrations')
  run('prisma migrate deploy')
} else {
  console.log(
    `[vercel-build] ${env} deploy — SKIPPING migrations. ` +
      'Preview databases are migrated out of band, never by a branch build.',
  )
}

run('next build')

/**
 * Create the SelectIQ Supabase Storage buckets.
 *
 * Plan 009 documents creating buckets by hand in the dashboard; this does it
 * reproducibly instead, so a fresh environment (e.g. the Phase-2 staging
 * project) can be provisioned with one command rather than clicking.
 *
 * Idempotent — a bucket that already exists is left as-is.
 *
 * Uses the Storage REST API directly rather than @supabase/supabase-js, which
 * needs a WebSocket polyfill under Node < 22 when run standalone.
 *
 * Run:  node scripts/create-storage-buckets.mjs
 * Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local.
 */

import { readFileSync } from 'node:fs'

// Minimal .env.local reader — no dependency on dotenv.
function readEnv(name) {
  try {
    const line = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${name}=`))
    if (!line) return undefined
    let v = line.slice(name.length + 1).trim().replace(/\r$/, '')
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
    return v
  } catch {
    return undefined
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? readEnv('NEXT_PUBLIC_SUPABASE_URL')
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? readEnv('SUPABASE_SERVICE_ROLE_KEY')

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

const BUCKETS = [
  {
    id: 'avatars',
    public: true,
    file_size_limit: 2 * 1024 * 1024,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'],
  },
  {
    id: 'org-logos',
    public: true,
    file_size_limit: 5 * 1024 * 1024,
    allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  },
  {
    // Private: students' résumés, served only through short-lived signed URLs.
    id: 'resumes',
    public: false,
    file_size_limit: 5 * 1024 * 1024,
    allowed_mime_types: ['application/pdf'],
  },
  // 'assessments' (private, signed URLs) is a Sprint 2 concern — created then.
]

for (const b of BUCKETS) {
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...b, name: b.id }),
  })
  const body = await res.json().catch(() => ({}))

  if (res.ok) console.log(`created  ${b.id}`)
  else if (/already exists|Duplicate/i.test(JSON.stringify(body))) console.log(`exists   ${b.id}`)
  else {
    console.error(`FAILED   ${b.id}: ${res.status} ${JSON.stringify(body)}`)
    process.exitCode = 1
  }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { config } from '@/lib/config'

/**
 * Supabase client — FILE STORAGE ONLY.
 *
 * ⚠️  NEVER use this client for database queries.
 *     ALL database reads and writes go through Prisma (`@/lib/prisma`).
 *     Supabase Auth is likewise unused — Firebase handles ALL authentication.
 *
 * Allowed operations: `.storage.from(bucket).upload() / .download() /
 * .createSignedUrl() / .remove() / .list()`
 *
 * Both clients are lazy. Creating them at module load would demand Supabase
 * credentials just to import this file, and would break builds before storage
 * is configured (Plan 009).
 */

/** Firebase owns the session. Never let Supabase persist or refresh one. */
const authOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const

let browserClient: SupabaseClient | undefined

/**
 * Browser-safe storage client. Uses the anon key and is bound by Supabase
 * Storage RLS policies. Safe to call from client components.
 *
 * ⚠️  Storage only. Do not call `.from()` for table access.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    const { url, anonKey } = config.supabase.client
    browserClient = createClient(url, anonKey, authOptions)
  }
  return browserClient
}

/**
 * Server-only storage client using the service-role key. Bypasses Storage RLS,
 * so it must NEVER be imported into a client component — `config.supabase`
 * throws if the service-role key is read in a browser context.
 *
 * Not cached: it holds the highest-privilege credential in the project, and a
 * module-level singleton is easier to leak across request boundaries.
 *
 * Use for: signed URLs, admin uploads, bucket cleanup.
 *
 * ⚠️  Storage only. Do not call `.from()` for table access.
 */
export function getSupabaseAdmin(): SupabaseClient {
  const { url } = config.supabase.client
  return createClient(url, config.supabase.serviceRoleKey, authOptions)
}

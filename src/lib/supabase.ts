import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client — FILE STORAGE ONLY.
 *
 * ⚠️  NEVER use this client for database queries.
 *     ALL database reads and writes go through Prisma (`@/lib/prisma`).
 *     Supabase Auth is likewise unused — Firebase handles ALL authentication.
 *
 * Allowed operations: `.storage.from(bucket).upload() / .download() /
 * .createSignedUrl() / .remove() / .list()`
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Warn rather than throw: the module is imported during builds where storage
  // credentials are not required.
  console.warn(
    '[supabase] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set. Storage calls will fail.',
  )
}

/**
 * Browser-safe storage client. Uses the anon key and is bound by Supabase
 * Storage RLS policies. Safe to import from client components.
 *
 * ⚠️  Storage only. Do not call `.from()` for table access.
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    // Firebase owns the session. Never let Supabase persist or refresh one.
    persistSession: false,
    autoRefreshToken: false,
  },
})

/**
 * Server-only storage client using the service-role key. Bypasses Storage RLS,
 * so it must NEVER be imported into a client component.
 *
 * Use for: signed URLs, admin uploads, bucket cleanup.
 *
 * ⚠️  Storage only. Do not call `.from()` for table access.
 */
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

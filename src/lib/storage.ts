import 'server-only'

import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Plan 009 — storage utilities.
 *
 * The ONLY legitimate use of the Supabase client in the codebase: file storage.
 * All database access is Prisma. These run server-side with the service-role
 * key, behind the auth checks in the API routes that call them.
 */

/**
 * Uploads (or replaces) a file at a fixed path.
 *
 * `upsert: true` so re-uploading an avatar overwrites the previous one at the
 * same path rather than piling up orphans.
 */
export async function uploadFile(
  bucket: string,
  path: string,
  body: Buffer | Uint8Array | Blob,
  contentType: string,
): Promise<{ path: string; url: string }> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: true,
  })
  if (error) throw error

  return { path, url: getPublicUrl(bucket, path) }
}

/** Public URL for a file in a public bucket. */
export function getPublicUrl(bucket: string, path: string): string {
  return getSupabaseAdmin().storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(bucket).remove([path])
  if (error) throw error
}

export async function listFiles(
  bucket: string,
  prefix: string,
): Promise<{ name: string; size: number }[]> {
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).list(prefix)
  if (error) throw error

  return (data ?? []).map((f) => ({ name: f.name, size: f.metadata?.size ?? 0 }))
}

/**
 * Plan 009 — file validation rules.
 *
 * These limits are enforced BOTH client-side (fast feedback, before upload) and
 * server-side (the real gate — a client check is trivially bypassed). The
 * bucket itself also enforces size and MIME at the Supabase layer, so this is
 * defence in depth, not the only line.
 */

export const FILE_LIMITS = {
  avatar: {
    maxSize: 2 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp'],
    bucket: 'avatars',
  },
  orgLogo: {
    maxSize: 5 * 1024 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    bucket: 'org-logos',
  },
  /**
   * Plan 018 — proctoring reference photos and per-snapshot triggers. Bucket
   * must be PRIVATE (Supabase dashboard) — nothing here is meant to be
   * publicly reachable; admins fetch via short-lived signed URLs.
   */
  proctoring: {
    // A 640×480 JPEG at Q0.7 is ~40KB; 512KB is generous headroom for
    // higher-res webcams and PNG debug uploads.
    maxSize: 512 * 1024,
    types: ['image/jpeg', 'image/png', 'image/webp'],
    bucket: 'proctoring',
  },
} as const

export type FileCategory = keyof typeof FILE_LIMITS

export type FileValidation = { valid: true } | { valid: false; error: string }

function humanSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(0)}MB`
    : `${(bytes / 1024).toFixed(0)}KB`
}

/**
 * Validates a file's type and size against a category's limits.
 *
 * Works on the browser `File` type and on any `{ size, type }` shape, so the
 * same function runs client-side and server-side.
 */
export function validateFile(
  file: { size: number; type: string },
  category: FileCategory,
): FileValidation {
  const limit = FILE_LIMITS[category]

  if (!(limit.types as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type. Allowed: ${limit.types
        .map((t) => t.replace('image/', ''))
        .join(', ')}.`,
    }
  }

  if (file.size > limit.maxSize) {
    return { valid: false, error: `File too large. Maximum is ${humanSize(limit.maxSize)}.` }
  }

  return { valid: true }
}

/** Map a validated MIME type to a file extension for the storage path. */
export function extensionForType(type: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  }
  return map[type] ?? 'bin'
}

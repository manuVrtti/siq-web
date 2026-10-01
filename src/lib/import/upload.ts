import 'server-only'

import type { NextRequest } from 'next/server'

import { withRole } from '@/lib/auth/require-role'
import { MANAGER_ROLES, getScope, type Scope } from '@/lib/auth/scope'
import { ValidationError } from '@/lib/errors'
import { ACCEPTED_EXTENSIONS, MAX_IMPORT_BYTES } from '@/lib/import/xlsx-parser'
import type { CurrentUser } from '@/types/auth'


/**
 * Plan 020 — shared front half of every import route: manager role, org
 * access for the orgId in the form, and a sane file (extension + size
 * checked before the bytes are read).
 */
export async function readImportUpload(
  request: NextRequest,
): Promise<{ user: CurrentUser; orgId: string; scope: Scope; departmentId: string | null; bytes: ArrayBuffer }> {
  const user = await withRole(MANAGER_ROLES)
  const form = await request.formData().catch(() => null)
  if (!form) throw new ValidationError('Expected a multipart form upload')

  const orgId = form.get('orgId')
  if (typeof orgId !== 'string' || !orgId) throw new ValidationError('orgId is required')
  const scope = await getScope(user, orgId)
  // Optional default department for rows without one (candidate imports).
  const dept = form.get('departmentId')
  const departmentId = typeof dept === 'string' && dept ? dept : null

  const file = form.get('file')
  if (!(file instanceof File)) throw new ValidationError('Attach a file')
  const lower = file.name.toLowerCase()
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new ValidationError('Upload an .xlsx, .xls or .csv file')
  }
  if (file.size > MAX_IMPORT_BYTES) {
    throw new ValidationError(`File is larger than ${MAX_IMPORT_BYTES / 1024 / 1024} MB`)
  }
  return { user, orgId, scope, departmentId, bytes: await file.arrayBuffer() }
}

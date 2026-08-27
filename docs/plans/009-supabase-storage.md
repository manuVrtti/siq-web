# Plan 009 — Supabase Storage Integration

## 1. Objective

Set up file upload/download infrastructure using Supabase Storage for profile photos, organization logos, and future assessment-related assets.

## 2. Scope

- Supabase JS client configured for storage only
- Storage utility functions (upload, download, delete, list)
- Storage bucket definitions and policies
- Server-side upload API route with validation
- Reusable file upload component
- Profile photo upload flow (end-to-end)

### Out of Scope

- Using Supabase client for database queries (Prisma is exclusive)
- Using Supabase client for auth (Firebase is exclusive)
- Assessment file uploads (Sprint 2+ feature)
- Image optimization/resizing (deferred)
- CDN configuration

## 3. Prerequisites / Dependencies

- Plan 02 completed (Supabase env vars validated)
- Plan 06 completed (auth middleware for protected upload routes)
- Plan 08 completed (UI components available for upload component)
- Supabase project active with Storage enabled

## 4. Technical Approach

Supabase JS client is used exclusively for storage operations. This is the only legitimate use of `@supabase/supabase-js` in the project — all data queries go through Prisma.

Storage buckets are created via the Supabase dashboard (not code). Policies are documented here for manual setup.

Upload flow:
1. Client selects file → validates type/size client-side
2. Client sends file as FormData to `/api/upload`
3. Server validates auth + file type + size
4. Server uploads to Supabase Storage via service role key
5. Server returns public URL
6. Client saves URL to relevant Prisma record (e.g., User.avatarUrl)

## 5. Implementation Steps

1. Install Supabase client: `npm install @supabase/supabase-js`
2. Create `lib/supabase/storage.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   // Storage-only client — NOT for auth or database
   const supabase = createClient(
     config.supabase.url,
     config.supabase.serviceRoleKey
   );

   export async function uploadFile(
     bucket: string,
     path: string,
     file: Buffer | Blob,
     contentType: string
   ): Promise<{ url: string }>

   export function getPublicUrl(bucket: string, path: string): string

   export async function deleteFile(bucket: string, path: string): Promise<void>

   export async function listFiles(
     bucket: string,
     prefix: string
   ): Promise<{ name: string; size: number }[]>
   ```
3. Define bucket structure (document for manual Supabase dashboard setup):
   ```
   Bucket: avatars
   - Public: yes (public read)
   - File size limit: 2MB
   - Allowed MIME types: image/jpeg, image/png, image/webp
   - Path pattern: {userId}/avatar.{ext}

   Bucket: org-logos
   - Public: yes (public read)
   - File size limit: 5MB
   - Allowed MIME types: image/jpeg, image/png, image/webp, image/svg+xml
   - Path pattern: {orgId}/logo.{ext}

   Bucket: assessments
   - Public: no (private, signed URLs)
   - File size limit: 50MB
   - Allowed MIME types: * (varied file types for assessments)
   - Path pattern: {orgId}/{assessmentId}/{filename}
   ```
4. Create `lib/validators/file.ts`:
   ```typescript
   export const FILE_LIMITS = {
     avatar: { maxSize: 2 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp'] },
     orgLogo: { maxSize: 5 * 1024 * 1024, types: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'] },
     assessment: { maxSize: 50 * 1024 * 1024, types: ['*'] },
   };

   export function validateFile(file: File, category: keyof typeof FILE_LIMITS): { valid: boolean; error?: string }
   ```
5. Create `/app/api/upload/route.ts`:
   ```typescript
   // POST: multipart form data
   // Fields: file (File), bucket (string), path (string)
   // Auth required
   // Validates file type + size server-side
   // Uploads to Supabase Storage
   // Returns { url: string }
   ```
6. Create `components/ui/file-upload.tsx`:
   ```typescript
   // Props: accept (mime types), maxSize, onUpload(url), onError
   // Features:
   //   - Drag-and-drop zone
   //   - Click to browse
   //   - Image preview (for image uploads)
   //   - Upload progress indicator
   //   - Client-side validation before upload
   //   - Error display
   ```
7. Create `/app/(protected)/settings/profile/page.tsx`:
   - Display current avatar (or placeholder)
   - FileUpload component for avatar
   - On upload success: PATCH user record to save avatarUrl
   - Name edit field
   - Save button
8. Create `/app/api/users/me/route.ts`:
   - **GET**: return current user data
   - **PATCH**: update name, avatarUrl → Prisma update
9. Update top bar avatar to use `user.avatarUrl` from context

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Install | `@supabase/supabase-js` | Supabase client |
| Create | `lib/supabase/storage.ts` | Storage utilities |
| Create | `lib/validators/file.ts` | File validation rules |
| Create | `app/api/upload/route.ts` | Upload endpoint |
| Create | `components/ui/file-upload.tsx` | Upload component |
| Create | `app/(protected)/settings/profile/page.tsx` | Profile page |
| Create | `app/api/users/me/route.ts` | User self-service API |
| Modify | `components/layout/top-bar.tsx` | Use real avatar |

## 7. Testing / Verification

- [ ] Upload avatar: select image → preview shown → upload → URL returned
- [ ] Avatar displays in profile page and top bar
- [ ] Drag-and-drop upload works
- [ ] File too large → client-side error before upload attempt
- [ ] Wrong file type → client-side error before upload attempt
- [ ] Server rejects oversized/wrong-type files (bypass client validation test)
- [ ] Unauthenticated upload attempt → 401
- [ ] Public URL for avatar is accessible without auth
- [ ] Uploading new avatar replaces the old one (same path)
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: "Supabase client is for STORAGE ONLY — never for auth or database queries"
- Add to `CLAUDE.md`: bucket structure, file validation rules, upload flow
- Add to `docs/project-context.md`: Plan 09 completed, storage infrastructure active

## 9. Estimated Effort

- Claude Code execution: ~40 minutes
- Manual setup: ~10 minutes (create buckets in Supabase dashboard)
- Manual testing: ~10 minutes
- Documentation updates: ~5 minutes

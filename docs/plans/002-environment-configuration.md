# Plan 002 — Environment & Configuration System

## 1. Objective

Set up Zod-validated environment variables so every service connection is type-safe and the app fails fast with a clear error message on misconfiguration.

## 2. Scope

- Install Zod
- Create validated env schema covering all services
- Create typed config module derived from validated env
- Populate `.env.example` with all required keys
- Ensure app crashes with descriptive error if any required var is missing

### Out of Scope

- Actually connecting to any external service (those happen in Plans 03–05)
- Secret rotation or vault integration
- Per-environment overrides beyond what `.env.local` provides

## 3. Prerequisites / Dependencies

- Plan 01 completed (Next.js project exists)
- No service accounts needed yet — we're just defining the shape

## 4. Technical Approach

Use Zod to parse `process.env` into a strongly-typed object at module load time. This gives us:
- Compile-time type safety (every env var accessed through the typed object)
- Runtime validation (missing or malformed vars throw immediately with the var name)
- Single source of truth (no scattered `process.env.X` calls)

Separate public (NEXT_PUBLIC_*) from server-only vars to prevent accidental client-side exposure.

## 5. Implementation Steps

1. Install Zod: `npm install zod`
2. Create `lib/env.ts`:
   ```typescript
   // Server-side env vars (never exposed to client)
   const serverSchema = z.object({
     DATABASE_URL: z.string().url(),
     SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
     MSG91_AUTH_KEY: z.string().min(1),
     MSG91_TEMPLATE_ID: z.string().min(1),
     MSG91_SENDER_ID: z.string().min(1),
     JUDGE0_API_URL: z.string().url(),
     FIREBASE_PROJECT_ID: z.string().min(1),
     FIREBASE_CLIENT_EMAIL: z.string().email(),
     FIREBASE_PRIVATE_KEY: z.string().min(1),
   });

   // Client-side env vars (exposed via NEXT_PUBLIC_ prefix)
   const clientSchema = z.object({
     NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
     NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
     NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
     NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
     NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
   });
   ```
3. Parse and export validated env objects with descriptive error messages
4. Create `lib/config.ts` — derived config object grouping vars by service:
   ```typescript
   export const config = {
     firebase: { apiKey, authDomain, projectId, ... },
     supabase: { url, anonKey, serviceRoleKey },
     msg91: { authKey, templateId, senderId },
     judge0: { apiUrl },
   }
   ```
5. Populate `.env.example` with every key (empty values, comments per section)
6. Verify `.env.local` is in `.gitignore`
7. Add a startup validation test: import `lib/env.ts` in `app/layout.tsx` server-side to trigger validation on every app start

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Install | `zod` | Validation library |
| Create | `lib/env.ts` | Zod schema + validation |
| Create | `lib/config.ts` | Typed config object |
| Modify | `.env.example` | All keys with comments |
| Verify | `.gitignore` | `.env.local` present |

## 7. Testing / Verification

- [ ] App starts normally with all vars set in `.env.local`
- [ ] Remove one required var → app crashes with message naming the missing var
- [ ] Set an invalid URL format → app crashes with validation error
- [ ] `config.firebase.apiKey` autocompletes in IDE (type safety works)
- [ ] No `NEXT_PUBLIC_` vars appear in server-only schema and vice versa
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: "Always import env vars from `@/lib/env` or `@/lib/config` — never read `process.env` directly"
- Add to `docs/project-context.md`: Plan 02 completed, env validation system in place

## 9. Estimated Effort

- Claude Code execution: ~20 minutes
- Manual testing: ~10 minutes
- Documentation updates: ~5 minutes

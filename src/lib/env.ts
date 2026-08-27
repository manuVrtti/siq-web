import { z } from 'zod'

/**
 * Plan 002 — validated environment variables.
 *
 * Every `process.env` read in the app should come through here or through
 * `@/lib/config`, so there is one place that knows what a valid environment
 * looks like and one place that produces a readable error when it isn't.
 *
 * Two rules drive the shape of this file:
 *
 * 1. Server and client vars are validated separately. A server var must never
 *    be reachable from browser code — `SUPABASE_SERVICE_ROLE_KEY` bypasses row
 *    level security, and `FIREBASE_ADMIN_PRIVATE_KEY` signs tokens.
 *
 * 2. Client vars are listed literally below. Next.js replaces
 *    `process.env.NEXT_PUBLIC_X` at build time by static text substitution; it
 *    cannot see through `process.env` when treated as an object, so spreading
 *    or iterating it yields `undefined` in the browser.
 */

/* ------------------------------------------------------------------ *
 * Schemas
 * ------------------------------------------------------------------ */

/** Required for the app to run at all. */
const coreServerSchema = z.object({
  DATABASE_URL: z.string().min(1, 'Supabase pooled connection string'),
  DIRECT_URL: z.string().min(1, 'Supabase session-pooler string, used by migrations'),
})

/**
 * Server vars for services wired up in later plans.
 *
 * Names follow CLAUDE.md, which uses the `FIREBASE_ADMIN_` prefix. Plan 002's
 * draft used bare `FIREBASE_` names; CLAUDE.md is the source of truth, and
 * `src/lib/firebase-admin.ts` already reads the prefixed form.
 */
const firebaseAdminSchema = z.object({
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1),
})

const supabaseServerSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

const msg91Schema = z.object({
  MSG91_AUTH_KEY: z.string().min(1),
  MSG91_TEMPLATE_ID: z.string().min(1),
  MSG91_SENDER_ID: z.string().min(1),
})

const judge0Schema = z.object({
  JUDGE0_API_URL: z.string().url(),
})

const firebaseClientSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
})

const supabaseClientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

/* ------------------------------------------------------------------ *
 * Raw values
 * ------------------------------------------------------------------ */

/**
 * Client vars, spelled out one by one so Next.js can inline them.
 * Do not refactor this into a loop or a spread — it will break in the browser.
 */
const rawClientEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}

/* ------------------------------------------------------------------ *
 * Parsing
 * ------------------------------------------------------------------ */

class EnvError extends Error {
  constructor(service: string, issues: z.ZodIssue[]) {
    const lines = issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    super(
      `Missing or invalid environment variables for "${service}":\n${lines.join('\n')}\n\n` +
        `Set them in .env.local (or .env for database URLs). See .env.example.`,
    )
    this.name = 'EnvError'
  }
}

/**
 * Guards against a server-only module being pulled into a client bundle.
 * Throws loudly rather than silently reading `undefined`.
 */
function assertServer(service: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `"${service}" configuration is server-only and must not be imported into client code.`,
    )
  }
}

/**
 * Validates lazily and caches the result.
 *
 * Deviation from plan 002 step 7, which asks for validation at app startup:
 * validating every service eagerly would stop the app booting until MSG91,
 * Judge0 and Firebase are all configured — none of which exist yet, and each
 * of which arrives in a later plan. Validating on first use keeps the same
 * fail-fast, named-variable error exactly where the missing value is needed.
 * See `validateCoreEnv()` for what is still checked at startup.
 */
function lazy<T extends z.ZodTypeAny>(
  service: string,
  schema: T,
  source: () => unknown,
  serverOnly = true,
): () => z.infer<T> {
  let cached: z.infer<T> | undefined

  return () => {
    if (cached) return cached
    if (serverOnly) assertServer(service)

    const result = schema.safeParse(source())
    if (!result.success) throw new EnvError(service, result.error.issues)

    cached = result.data
    return cached
  }
}

export const getCoreEnv = lazy('database', coreServerSchema, () => process.env)
export const getFirebaseAdminEnv = lazy('firebase-admin', firebaseAdminSchema, () => process.env)
export const getSupabaseServerEnv = lazy('supabase-server', supabaseServerSchema, () => process.env)
export const getMsg91Env = lazy('msg91', msg91Schema, () => process.env)
export const getJudge0Env = lazy('judge0', judge0Schema, () => process.env)

export const getFirebaseClientEnv = lazy(
  'firebase-client',
  firebaseClientSchema,
  () => rawClientEnv,
  false,
)
export const getSupabaseClientEnv = lazy(
  'supabase-client',
  supabaseClientSchema,
  () => rawClientEnv,
  false,
)

/**
 * Startup check for the variables the app cannot run without.
 *
 * Called from the root layout so a misconfigured database fails immediately
 * with a named variable, rather than at the first query. Service-specific vars
 * are deliberately not checked here — see `lazy()` above.
 */
export function validateCoreEnv(): void {
  getCoreEnv()
}

import {
  getFirebaseAdminEnv,
  getFirebaseClientEnv,
  getJudge0Env,
  getMsg91Env,
  getSupabaseClientEnv,
  getSupabaseServerEnv,
} from '@/lib/env'

/**
 * Plan 002 — typed config, grouped by service.
 *
 * Prefer this over reading `process.env` directly. Each group is a getter, so
 * accessing `config.firebase.client` validates only Firebase client vars and
 * throws naming exactly what's missing. Touching one service never demands
 * that unrelated services be configured.
 *
 * ⚠️  `config.firebase.admin`, `config.supabase.serviceRoleKey`, `config.msg91`
 *     and `config.judge0` are SERVER-ONLY. They throw if reached from browser
 *     code. Never import them into a client component.
 */
export const config = {
  firebase: {
    /** Browser-safe Firebase web config. */
    get client() {
      const e = getFirebaseClientEnv()
      return {
        apiKey: e.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: e.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: e.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: e.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: e.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: e.NEXT_PUBLIC_FIREBASE_APP_ID,
      }
    },

    /** ⚠️  Server-only. Signs custom tokens and verifies ID tokens. */
    get admin() {
      const e = getFirebaseAdminEnv()
      return {
        projectId: e.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: e.FIREBASE_ADMIN_CLIENT_EMAIL,
        // Vercel and .env files store the PEM with literal "\n" sequences.
        privateKey: e.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }
    },
  },

  supabase: {
    /** Browser-safe. Storage only — never database queries. */
    get client() {
      const e = getSupabaseClientEnv()
      return {
        url: e.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      }
    },

    /** ⚠️  Server-only. Bypasses storage row level security. */
    get serviceRoleKey() {
      return getSupabaseServerEnv().SUPABASE_SERVICE_ROLE_KEY
    },
  },

  /** ⚠️  Server-only. Phone OTP for Indian carriers (DLT compliance). */
  get msg91() {
    const e = getMsg91Env()
    return {
      authKey: e.MSG91_AUTH_KEY,
      templateId: e.MSG91_TEMPLATE_ID,
      senderId: e.MSG91_SENDER_ID,
    }
  },

  /** ⚠️  Server-only. Self-hosted code execution. */
  get judge0() {
    return { apiUrl: getJudge0Env().JUDGE0_API_URL }
  },
} as const

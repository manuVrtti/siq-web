import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  type Auth,
} from 'firebase/auth'

import { config } from '@/lib/config'

/**
 * Firebase client SDK — browser-side authentication only.
 *
 * Firebase handles ALL authentication for SelectIQ:
 *   - Google OAuth
 *   - GitHub OAuth
 *   - Phone OTP (MSG91 verifies, server mints a Firebase custom token)
 *
 * ⚠️  Never use Firestore or Realtime Database. Supabase PostgreSQL (via
 *     Prisma) is the only database.
 *
 * Config is read lazily inside `getFirebaseApp()` rather than at module load,
 * so importing this file does not require Firebase to be configured yet.
 */

/** Reuses the existing app across hot reloads instead of re-initializing. */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config.firebase.client)
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export const googleProvider = new GoogleAuthProvider()
export const githubProvider = new GithubAuthProvider()

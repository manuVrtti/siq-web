import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  type Auth,
} from 'firebase/auth'

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
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

/** Reuses the existing app across hot reloads instead of re-initializing. */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp())
}

export const googleProvider = new GoogleAuthProvider()
export const githubProvider = new GithubAuthProvider()

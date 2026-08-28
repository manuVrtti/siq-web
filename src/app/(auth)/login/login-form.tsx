'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithPopup, type AuthProvider } from 'firebase/auth'
import { FirebaseError } from 'firebase/app'

import { getFirebaseAuth, githubProvider, googleProvider } from '@/lib/firebase-client'

/**
 * Plan 004 — Google and GitHub sign-in.
 *
 * Flow: popup OAuth → Firebase ID token → POST /api/auth/session → the server
 * verifies the token, upserts the user and sets an HTTP-only cookie. The token
 * is never stored client-side.
 */

type Pending = 'google' | 'github' | null

/** Turns Firebase error codes into something a candidate can act on. */
function describeAuthError(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return 'Something went wrong signing you in. Please try again.'
  }

  switch (error.code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.'
    case 'auth/account-exists-with-different-credential':
      return 'That email is already registered with a different sign-in method. Use the provider you signed up with.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.'
    default:
      return `Sign-in failed (${error.code}).`
  }
}

export default function LoginForm() {
  const router = useRouter()
  const [pending, setPending] = useState<Pending>(null)
  const [error, setError] = useState<string | null>(null)

  const signIn = useCallback(
    async (which: Exclude<Pending, null>, provider: AuthProvider) => {
      setPending(which)
      setError(null)

      try {
        const credential = await signInWithPopup(getFirebaseAuth(), provider)
        const idToken = await credential.user.getIdToken()

        const response = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        })

        if (!response.ok) {
          throw new Error('Could not establish a session. Please try again.')
        }

        // refresh() re-runs the server components so the new cookie is picked up.
        router.replace('/dashboard')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error && !(err instanceof FirebaseError)
          ? err.message
          : describeAuthError(err))
        setPending(null)
      }
    },
    [router],
  )

  const busy = pending !== null

  return (
    <div className="flex w-full flex-col gap-3">
      <button
        type="button"
        disabled={busy}
        onClick={() => signIn('google', googleProvider)}
        className="rounded-md border border-current/20 px-4 py-2.5 text-sm font-medium transition-colors hover:border-current/40 disabled:opacity-50"
      >
        {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => signIn('github', githubProvider)}
        className="rounded-md border border-current/20 px-4 py-2.5 text-sm font-medium transition-colors hover:border-current/40 disabled:opacity-50"
      >
        {pending === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

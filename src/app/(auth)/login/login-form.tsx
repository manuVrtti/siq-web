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
        router.replace('/select-org')
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
        className="siq-focus group bg-card hover:border-primary/40 flex h-12 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card-hover)] active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
      >
        <GoogleLogo />
        {pending === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => signIn('github', githubProvider)}
        className="siq-focus bg-card hover:border-foreground/30 flex h-12 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-60"
      >
        <GitHubLogo />
        {pending === 'github' ? 'Opening GitHub…' : 'Continue with GitHub'}
      </button>

      {error && (
        <p role="alert" className="bg-destructive/5 text-destructive rounded-lg px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3a7.2 7.2 0 0 1-10.8-3.8h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
    </svg>
  )
}

function GitHubLogo() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  )
}

'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup, type AuthProvider, type User } from 'firebase/auth'
import { Eye, EyeOff, Loader2, Mail } from 'lucide-react'
import { FirebaseError } from 'firebase/app'

import { getFirebaseAuth, githubProvider, googleProvider } from '@/lib/firebase-client'

/**
 * Plan 004 — Google and GitHub sign-in.
 *
 * Flow: popup OAuth → Firebase ID token → POST /api/auth/session → the server
 * verifies the token, upserts the user and sets an HTTP-only cookie. The token
 * is never stored client-side.
 */

type Pending = 'google' | 'github' | 'password' | null

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
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match. Check both, or use “Forgot password”.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a few minutes, or reset your password.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact your placement cell.'
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

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const finish = useCallback(
    async (fbUser: User) => {
      const idToken = await fbUser.getIdToken()
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })
      if (!response.ok) {
        const json = await response.json().catch(() => null)
        // Our own errors (e.g. a suspended account) carry a safe message.
        throw new Error(response.status === 403 && json?.error?.message ? json.error.message : 'Could not establish a session. Please try again.')
      }
      // refresh() re-runs the server components so the new cookie is picked up.
      // A temporary-password session is forwarded on to /set-password.
      router.replace('/select-org')
      router.refresh()
    },
    [router],
  )

  const fail = useCallback((err: unknown) => {
    setError(err instanceof Error && !(err instanceof FirebaseError) ? err.message : describeAuthError(err))
    setPending(null)
  }, [])

  const signIn = useCallback(
    async (which: Exclude<Pending, null>, provider: AuthProvider) => {
      setPending(which)
      setError(null)
      setNotice(null)
      try {
        const credential = await signInWithPopup(getFirebaseAuth(), provider)
        await finish(credential.user)
      } catch (err) {
        fail(err)
      }
    },
    [finish, fail],
  )

  async function signInWithPassword(e: React.FormEvent) {
    e.preventDefault()
    setPending('password')
    setError(null)
    setNotice(null)
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password)
      await finish(cred.user)
    } catch (err) {
      fail(err)
    }
  }

  async function forgotPassword() {
    setError(null)
    setNotice(null)
    const address = email.trim()
    if (!address) {
      setError('Type your email above first, then tap “Forgot password”.')
      return
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), address, { url: `${window.location.origin}/login` })
    } catch (err) {
      // Never reveal whether an address exists; only surface real input errors.
      if (err instanceof FirebaseError && err.code === 'auth/invalid-email') {
        fail(err)
        return
      }
    }
    setNotice(`If ${address} has a SelectIQ password, a reset link is on its way. Check spam too.`)
  }

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

      <div className="text-muted-foreground my-2 flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" />
        or with your college email
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={signInWithPassword} className="flex flex-col gap-2.5">
        <label className="sr-only" htmlFor="login-email">
          Email
        </label>
        <div className="relative">
          <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" aria-hidden />
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu.in"
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-12 w-full rounded-xl border pr-3 pl-10 text-sm transition-shadow outline-none focus-visible:ring-3"
          />
        </div>
        <label className="sr-only" htmlFor="login-password">
          Password
        </label>
        <div className="relative">
          <input
            id="login-password"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/40 h-12 w-full rounded-xl border pr-11 pl-3.5 text-sm transition-shadow outline-none focus-visible:ring-3"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 grid w-11 place-items-center"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={forgotPassword} className="text-primary text-xs font-medium hover:underline">
            Forgot password?
          </button>
          <button
            type="submit"
            disabled={busy}
            className="siq-focus bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-primary)] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
          >
            {pending === 'password' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Sign in
          </button>
        </div>
      </form>

      {notice ? (
        <p role="status" className="bg-success/10 text-success rounded-lg px-3 py-2 text-sm">
          {notice}
        </p>
      ) : null}

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

'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'

import { getFirebaseAuth } from '@/lib/firebase-client'

/**
 * Plan 004 — sign out.
 *
 * Order matters: clear the server session first, then the Firebase client
 * state. If the request fails we stop, otherwise the UI would claim signed-out
 * while the HTTP-only cookie still grants access.
 */
export default function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignOut = useCallback(async () => {
    setPending(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE' })
      if (!response.ok) throw new Error('Sign out failed')

      await signOut(getFirebaseAuth())

      router.replace('/login')
      router.refresh()
    } catch {
      setError('Could not sign out. Please try again.')
      setPending(false)
    }
  }, [router])

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={pending}
        className="self-start rounded-md border border-current/20 px-4 py-2 text-sm font-medium transition-colors hover:border-current/40 disabled:opacity-50"
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}

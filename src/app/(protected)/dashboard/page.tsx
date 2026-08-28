import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getSessionUser } from '@/lib/auth/session'

import SignOutButton from './sign-out-button'

/**
 * Plan 004 — minimal protected page.
 *
 * Proves the full round trip: OAuth popup -> ID token -> session cookie ->
 * Prisma row -> server-rendered name. Plan 006 moves this guard into
 * middleware so every protected route is covered by default; until then the
 * check lives here.
 */

export const metadata: Metadata = {
  title: 'Dashboard — SelectIQ',
}

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {user.name ?? user.email ?? 'there'}
        </h1>
        <p className="text-sm opacity-60">
          Signed in as {user.email ?? user.phone ?? 'unknown'} &middot; role {user.role}
        </p>
      </div>

      <SignOutButton />
    </main>
  )
}

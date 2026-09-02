import type { Metadata } from 'next'

import RoleGate from '@/components/auth/role-gate'
import { PERMISSIONS } from '@/constants/permissions'
import { getCurrentUser } from '@/lib/auth/get-current-user'

import SignOutButton from './sign-out-button'

/**
 * Plan 004/007 — minimal protected page.
 *
 * The auth guard lives in `(protected)/layout.tsx`, so this page can assume a
 * user. `getCurrentUser()` is React-cached, so calling it again here reuses the
 * layout's result rather than re-verifying.
 */

export const metadata: Metadata = {
  title: 'Dashboard — SelectIQ',
}

export default async function DashboardPage() {
  // Non-null: the layout redirects when signed out.
  const user = (await getCurrentUser())!

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

      {/*
        RoleGate decides what to draw, never what is permitted. The matching
        server-side check lives in /api/admin/users.
      */}
      <RoleGate
        allowedRoles={['COLLEGE_ADMIN', 'SUPER_ADMIN']}
        fallback={
          <p className="text-sm opacity-40">
            Admin tools are hidden for your role ({user.role}).
          </p>
        }
      >
        <p className="text-sm">Admin tools would appear here.</p>
      </RoleGate>

      <RoleGate permission={PERMISSIONS.TAKE_ASSESSMENT}>
        <p className="text-sm">You are eligible to take assessments.</p>
      </RoleGate>

      <SignOutButton />
    </main>
  )
}

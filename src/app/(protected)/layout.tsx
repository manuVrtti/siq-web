import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { UserProvider } from '@/lib/auth/user-context'

/**
 * Plan 007/T02 — authenticated area guard.
 *
 * Enforces a real session (the proxy only checks the cookie exists) and
 * provides the current user. The app shell and tenant context live one level
 * down, in [org]/layout, because they need the active organization — which is
 * resolved from the URL there.
 */
export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // A college-issued temporary password must be replaced before anything else.
  if (user.mustChangePassword) redirect('/set-password')

  return <UserProvider user={user}>{children}</UserProvider>
}

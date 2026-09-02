import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { UserProvider } from '@/lib/auth/user-context'

/**
 * Plan 007 — layout for authenticated pages.
 *
 * Resolves the user once here and hands it to a client-side provider, so
 * components below can read the role synchronously via `useCurrentUser()`
 * without each one fetching. `getCurrentUser` is React-cached, so pages under
 * this layout calling it again cost nothing extra.
 *
 * The redirect is a real guard, not decoration: the proxy only checks that a
 * cookie exists, so an expired or forged one reaches this point.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <UserProvider user={user}>{children}</UserProvider>
}

import { redirect } from 'next/navigation'

import AppShell from '@/components/layout/app-shell'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { UserProvider } from '@/lib/auth/user-context'

/**
 * Plan 007/008 — layout for authenticated pages.
 *
 * Resolves the user once, hands it to the client provider, and wraps
 * everything in the app shell. `getCurrentUser` is React-cached, so pages
 * below calling it again cost nothing.
 *
 * The redirect is a real guard: the proxy only checks that a cookie exists,
 * so an expired or forged one reaches this point.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <UserProvider user={user}>
      <AppShell>{children}</AppShell>
    </UserProvider>
  )
}

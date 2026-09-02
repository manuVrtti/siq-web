import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'

/**
 * Plan 004/008 — layout for unauthenticated pages.
 *
 * Anyone already signed in is bounced to the dashboard, so a valid session
 * never sees a login form.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (user) redirect('/dashboard')

  return (
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      {children}
    </main>
  )
}

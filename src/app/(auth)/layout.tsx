import { redirect } from 'next/navigation'

import { getSessionUser } from '@/lib/auth/session'

/**
 * Plan 004 — layout for unauthenticated pages.
 *
 * Anyone already signed in is bounced to the dashboard, so a valid session
 * never sees a login form.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-current/10 p-8">
        {children}
      </div>
    </main>
  )
}

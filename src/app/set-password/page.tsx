import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { KeyRound, ShieldCheck } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import { getCurrentUser } from '@/lib/auth/get-current-user'

import { SetPasswordForm } from './set-password-form'

export const metadata: Metadata = { title: 'Set your password — SelectIQ' }

/**
 * First sign-in with a college-issued temporary password. The protected
 * layout and exam pages send anyone carrying the claim here; nobody else
 * has a reason to see it.
 */
export default async function SetPasswordPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.mustChangePassword) redirect('/select-org')

  return (
    <main className="grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark className="size-8" />
          <span className="font-display text-base font-semibold tracking-tight">SelectIQ</span>
        </div>
        <div className="siq-card siq-rise p-6 sm:p-8">
          <span className="bg-highlight-tint text-highlight-foreground grid size-12 place-items-center rounded-2xl">
            <KeyRound className="size-6" aria-hidden />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Choose your own password</h1>
          <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
            You signed in with a temporary password from your college. Pick one only you know — you&apos;ll use it
            from now on with <b className="text-foreground">{user.email}</b>.
          </p>
          <SetPasswordForm email={user.email ?? ''} />
        </div>
        <p className="text-muted-foreground mt-5 flex items-center justify-center gap-1.5 text-xs">
          <ShieldCheck className="size-3.5" aria-hidden />
          Your college can no longer see or use the temporary password after this.
        </p>
      </div>
    </main>
  )
}

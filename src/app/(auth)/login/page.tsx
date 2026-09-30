import type { Metadata } from 'next'

import { BrandMark } from '@/components/brand/mark'

import LoginForm from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — SelectIQ',
}

/**
 * Plan 019 UI redesign — the login page is the first thing anyone sees.
 * Card removed: the form sits directly on the ground so the two-column
 * auth layout doesn't feel like a card on a card. The right-hand brand
 * panel does the visual work.
 */
export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex flex-col gap-3">
        <BrandMark className="size-10 lg:hidden" />
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in or create your account</h1>
          <p className="text-muted-foreground text-sm">
            Students: use your college email. New here? Signing in creates your account — we&apos;ll
            ask a few details next.
          </p>
        </div>
      </div>

      <LoginForm />

      <p className="text-muted-foreground mt-8 text-xs">
        Trouble signing in? Contact your college placement cell.
      </p>
    </div>
  )
}

import type { Metadata } from 'next'


import { safeNextPath } from '@/lib/seb'

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
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next)
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Welcome to SelectIQ</h1>
      {next?.startsWith('/exam/') ? (
        <p className="bg-primary/10 text-primary mt-3 rounded-lg px-3 py-2 text-sm font-medium">Sign in to open your exam.</p>
      ) : null}
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Sign in with your college email. New here? Signing in creates your account — we&apos;ll ask
        a few details next.
      </p>

      <div className="mt-8">
        <LoginForm next={next} />
      </div>

      <p className="text-muted-foreground mt-8 text-xs leading-relaxed">
        By continuing you agree to take assessments in SIQ-Browser, SelectIQ’s secure exam app, when your college
        requires it. Trouble signing in? Contact your placement cell.
      </p>
    </div>
  )
}

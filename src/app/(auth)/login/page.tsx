import type { Metadata } from 'next'

import LoginForm from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — SelectIQ',
}

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in to SelectIQ</h1>
        <p className="text-sm opacity-60">
          Use the account your college or employer registered.
        </p>
      </div>

      <LoginForm />
    </div>
  )
}

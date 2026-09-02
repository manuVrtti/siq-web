import type { Metadata } from 'next'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

import LoginForm from './login-form'

export const metadata: Metadata = {
  title: 'Sign in — SelectIQ',
}

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="items-center text-center">
        <div className="bg-primary text-primary-foreground mx-auto mb-2 grid size-10 place-items-center rounded-lg text-sm font-bold">
          S
        </div>
        <CardTitle className="text-xl">Sign in to SelectIQ</CardTitle>
        <CardDescription>Use the account your college or employer registered.</CardDescription>
      </CardHeader>

      <CardContent>
        <LoginForm />
      </CardContent>
    </Card>
  )
}

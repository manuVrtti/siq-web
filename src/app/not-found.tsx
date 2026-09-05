import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * Plan 010 — custom 404.
 *
 * Also what a signed-in user sees for a page they may not access, when the
 * route chooses to hide existence rather than return 403 — telling someone a
 * page exists but is forbidden leaks the shape of the system.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground font-mono text-sm">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground max-w-md text-sm">
          The page you are looking for does not exist, or you do not have access to it.
        </p>
      </div>

      <Button render={<Link href="/dashboard" />}>Back to dashboard</Button>
    </main>
  )
}

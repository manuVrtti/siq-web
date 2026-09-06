import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'

import EmptyState from '@/components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getUserOrgs } from '@/lib/auth/org-access'

export const metadata: Metadata = { title: 'Choose organization — SelectIQ' }

/**
 * Plan T02 — post-login entry.
 *
 * Sends the user into their tenant. One org → straight in. Several → a picker.
 * None → an explains-itself empty state (access is granted by a college, not
 * self-serve).
 */
export default async function SelectOrgPage() {
  const user = (await getCurrentUser())!
  const orgs = await getUserOrgs(user.id)

  if (orgs.length === 1) redirect(`/${orgs[0].slug}/dashboard`)

  if (orgs.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <EmptyState
          icon={Building2}
          title="No organization yet"
          description="Your access is granted by your college or employer. Once you're added, your workspace appears here."
        />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="text-xl font-semibold tracking-tight">Choose an organization</h1>
      <div className="flex flex-col gap-2">
        {orgs.map((o) => (
          <Link key={o.id} href={`/${o.slug}/dashboard`}>
            <Card className="transition-colors hover:border-current/30">
              <CardHeader>
                <CardTitle className="text-base">{o.name}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground pt-0 text-sm">/{o.slug}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}

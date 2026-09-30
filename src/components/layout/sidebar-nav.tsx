'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { navItemsForRole } from '@/constants/navigation'
import { useCurrentUser } from '@/lib/auth/user-context'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

/**
 * Plan 019 — sidebar nav list.
 *
 * Active row: a violet-tinted background (primary/12) plus a 2px left
 * marker in --primary. The marker is drawn as a pseudo-element (::before)
 * inside the flex row so it doesn't affect layout height. Inactive rows
 * hover to --sidebar-accent, matching the SEB shell's own conventions.
 *
 * Same list renders inside the desktop sidebar and the mobile drawer —
 * split from the shell so both consumers stay in sync.
 */
export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const org = useActiveOrg()
  const pathname = usePathname()

  if (!user) return null

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {navItemsForRole(user.role).map(({ label, href, icon: Icon, absolute }) => {
        const fullHref = absolute ? href : `/${org.slug}${href}`
        // Exact match, or a nested route beneath it — so /questions/new
        // still highlights Questions, while /results does not match /r.
        const active = pathname === fullHref || pathname.startsWith(`${fullHref}/`)

        return (
          <Link
            key={href}
            href={fullHref}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-primary/12 text-sidebar-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground',
            )}
          >
            {active ? (
              <span
                aria-hidden
                className="bg-primary absolute inset-y-1.5 left-0 w-[3px] rounded-full"
              />
            ) : null}
            <Icon
              className={cn(
                'size-4 shrink-0 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground',
              )}
              aria-hidden
            />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { navItemsForRole } from '@/constants/navigation'
import { useCurrentUser } from '@/lib/auth/user-context'
import { useActiveOrg } from '@/lib/org-context'
import { cn } from '@/lib/utils'

/**
 * Plan 008 — the navigation link list.
 *
 * Split out from the sidebar shell so the same list can render inside the
 * desktop sidebar and the mobile drawer without duplication.
 */
export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const org = useActiveOrg()
  const pathname = usePathname()

  if (!user) return null

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {navItemsForRole(user.role).map(({ label, href, icon: Icon }) => {
        // Nav hrefs are sub-paths; prefix with the active org's slug.
        const fullHref = `/${org.slug}${href}`
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
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

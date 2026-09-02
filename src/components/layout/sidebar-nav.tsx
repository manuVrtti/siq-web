'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { navItemsForRole } from '@/constants/navigation'
import { useCurrentUser } from '@/lib/auth/user-context'
import { cn } from '@/lib/utils'

/**
 * Plan 008 — the navigation link list.
 *
 * Split out from the sidebar shell so the same list can render inside the
 * desktop sidebar and the mobile drawer without duplication.
 */
export default function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const user = useCurrentUser()
  const pathname = usePathname()

  if (!user) return null

  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {navItemsForRole(user.role).map(({ label, href, icon: Icon }) => {
        // Exact match, or a nested route beneath it — so /assessments/new
        // still highlights Assessments, while /results does not match /r.
        const active = pathname === href || pathname.startsWith(`${href}/`)

        return (
          <Link
            key={href}
            href={href}
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

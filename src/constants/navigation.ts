import {
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  LibraryBig,
  LineChart,
  UserRound,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { UserRole } from '@prisma/client'

/**
 * Plan 008 — sidebar navigation.
 *
 * `roles: 'ALL'` means every signed-in role. Otherwise the item only renders
 * for the roles listed.
 *
 * ⚠️  Hiding a link is not access control. Anyone can type the URL. Each page
 *     and API route behind these links must enforce its own check with
 *     `withRole()` / `withPermission()` — see Plan 007.
 */
export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  roles: 'ALL' | readonly UserRole[]
  /** Absolute link, not prefixed with the active org (e.g. the platform console). */
  absolute?: boolean
}

const MANAGERS = ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'] as const

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: 'ALL' },
  { label: 'My profile', href: '/profile', icon: UserRound, roles: ['STUDENT'] },
  { label: 'Assessments', href: '/assessments', icon: ClipboardCheck, roles: MANAGERS },
  { label: 'Question bank', href: '/questions', icon: LibraryBig, roles: MANAGERS },
  { label: 'Candidates', href: '/candidates', icon: Users, roles: MANAGERS },
  // Students see their own results on the dashboard and at /my-results; the
  // org-wide results page is manager-only (Plan 016 gates it server-side).
  { label: 'Results', href: '/results', icon: FileCheck2, roles: MANAGERS },
  { label: 'Analytics', href: '/analytics', icon: LineChart, roles: MANAGERS },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['COLLEGE_ADMIN', 'SUPER_ADMIN'],
  },
  { label: 'Platform console', href: '/admin', icon: Shield, roles: ['SUPER_ADMIN'], absolute: true },
]

/** Nav items this role may see. */
export function navItemsForRole(role: UserRole): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'ALL' || item.roles.includes(role))
}

import {
  BarChart3,
  ClipboardCheck,
  LayoutDashboard,
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
}

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: 'ALL' },
  {
    label: 'Assessments',
    href: '/assessments',
    icon: ClipboardCheck,
    roles: ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'],
  },
  {
    label: 'Candidates',
    href: '/candidates',
    icon: Users,
    roles: ['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'],
  },
  { label: 'Results', href: '/results', icon: BarChart3, roles: 'ALL' },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['COLLEGE_ADMIN', 'SUPER_ADMIN'],
  },
  { label: 'Admin', href: '/admin', icon: Shield, roles: ['SUPER_ADMIN'] },
]

/** Nav items this role may see. */
export function navItemsForRole(role: UserRole): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'ALL' || item.roles.includes(role))
}

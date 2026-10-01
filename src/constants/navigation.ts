import {
  ClipboardCheck,
  FileCheck2,
  LayoutDashboard,
  LibraryBig,
  LineChart,
  MessagesSquare,
  UserRound,
  Shield,
  ShieldCheck,
  Building2,
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
  /** Small tag after the label, e.g. "Soon" for a feature that isn't live yet. */
  badge?: string
}

const MANAGERS = ['COLLEGE_ADMIN', 'COLLEGE_HOD', 'RECRUITER', 'SUPER_ADMIN'] as const

export const NAV_ITEMS: readonly NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: 'ALL' },
  // Student tabs. Their own routes (my-*) rather than the manager pages, which
  // are permission-gated and show org-wide data.
  { label: 'Assessments', href: '/my-assessments', icon: ClipboardCheck, roles: ['STUDENT'] },
  { label: 'Mock interviews', href: '/mock-interviews', icon: MessagesSquare, roles: ['STUDENT'], badge: 'Soon' },
  { label: 'Analytics', href: '/my-analytics', icon: LineChart, roles: ['STUDENT'] },
  { label: 'My results', href: '/my-results', icon: FileCheck2, roles: ['STUDENT'], absolute: true },
  { label: 'My profile', href: '/profile', icon: UserRound, roles: ['STUDENT'] },
  { label: 'Assessments', href: '/assessments', icon: ClipboardCheck, roles: MANAGERS },
  { label: 'Question bank', href: '/questions', icon: LibraryBig, roles: MANAGERS },
  { label: 'Candidates', href: '/candidates', icon: Users, roles: MANAGERS },
  // Students see their own results on the dashboard and at /my-results; the
  // org-wide results page is manager-only (Plan 016 gates it server-side).
  { label: 'Results', href: '/results', icon: FileCheck2, roles: MANAGERS },
  { label: 'Analytics', href: '/analytics', icon: LineChart, roles: MANAGERS },
  // Role panels: College Admin runs the college; HOD runs their department(s).
  { label: 'College admin', href: '/manage', icon: ShieldCheck, roles: ['COLLEGE_ADMIN', 'SUPER_ADMIN'] },
  { label: 'My department', href: '/department', icon: Building2, roles: ['COLLEGE_HOD'] },
  { label: 'Platform console', href: '/admin', icon: Shield, roles: ['SUPER_ADMIN'], absolute: true },
]

/** Nav items this role may see. */
export function navItemsForRole(role: UserRole): readonly NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles === 'ALL' || item.roles.includes(role))
}

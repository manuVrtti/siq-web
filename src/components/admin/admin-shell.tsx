'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, Building2, LayoutDashboard, Megaphone, Menu, Network, ScrollText, Search, ShieldCheck, Users } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

/**
 * Platform admin console shell (ABtalks /admin pattern): its own header and
 * a grouped sidebar, separate from the per-college workspace shell because
 * the console is cross-tenant.
 */

const GROUPS = [
  {
    label: 'Platform',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
      { href: '/admin/search', label: 'Search', icon: Search },
      { href: '/admin/organizations', label: 'Colleges & companies', icon: Building2 },
      { href: '/admin/taxonomy', label: 'Topics & skills', icon: Network },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'All people', icon: Users },
      { href: '/admin/platform-admins', label: 'Platform admins', icon: ShieldCheck },
    ],
  },
  {
    label: 'Communication',
    items: [
      { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    ],
  },
  {
    label: 'Governance',
    items: [{ href: '/admin/audit', label: 'Audit log', icon: ScrollText }],
  },
] as const

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {GROUPS.map((g) => (
        <div key={g.label}>
          <p className="text-sidebar-muted mb-1.5 px-3 text-[10.5px] font-medium tracking-[0.14em] uppercase">{g.label}</p>
          <div className="flex flex-col gap-0.5">
            {g.items.map(({ href, label, icon: Icon, ...rest }) => {
              const exact = 'exact' in rest && rest.exact
              const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn('siq-nav-item', active ? 'siq-nav-active' : 'siq-nav-idle')}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
      <Link
        href="/select-org"
        onClick={onNavigate}
        className="text-sidebar-muted hover:text-sidebar-foreground mt-2 inline-flex items-center gap-2 px-3 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to workspace
      </Link>
    </nav>
  )
}

export function AdminShell({ children, userName }: { children: ReactNode; userName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col border-r px-3 pt-4 md:flex">
        <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
          <BrandMark className="size-7" />
          <span className="font-display text-sm font-semibold tracking-tight">SelectIQ</span>
          <span className="bg-highlight text-highlight-foreground rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase">Admin</span>
        </Link>
        <Nav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="siq-header">
          <div className="flex items-center gap-2">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />}>
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-64 p-3 pt-6">
                <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                <Nav onNavigate={() => setOpen(false)} />
              </SheetContent>
            </Sheet>
            <p className="text-sm font-semibold">Platform console</p>
          </div>
          <form action="/admin/search" className="relative hidden max-w-md flex-1 sm:block">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
            <input
              name="q"
              placeholder="Search colleges, people, departments…"
              aria-label="Search the platform"
              className="border-input bg-card focus-visible:border-ring h-9 w-full rounded-lg border pr-3 pl-9 text-sm outline-none"
            />
          </form>
          <p className="text-muted-foreground hidden text-xs lg:block">
            Signed in as <span className="text-foreground font-medium">{userName}</span> · super admin
          </p>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}

'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import { BrandMark, BrandWordmark } from '@/components/brand/mark'
import SidebarNav from '@/components/layout/sidebar-nav'
import UserMenu from '@/components/layout/user-menu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCurrentUser } from '@/lib/auth/user-context'
import { useActiveOrg } from '@/lib/org-context'

/**
 * Plan 019 UI redesign — the authenticated app shell.
 *
 * A quieter, denser sidebar with a real wordmark and an active-org line so
 * the tenant context is obvious. Content area has a slightly-elevated
 * ground (main = --background, sidebar = --sidebar) so the two planes read
 * without a shadow. Responsiveness is CSS only.
 */

function Brand() {
  const org = useActiveOrg()
  return (
    <Link
      href={`/${org.slug}/dashboard`}
      className="hover:bg-sidebar-accent flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors"
    >
      <BrandWordmark />
    </Link>
  )
}

function OrgLine() {
  const org = useActiveOrg()
  return (
    <div className="px-3 pb-3">
      <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
        Workspace
      </p>
      <p className="text-sidebar-foreground truncate text-sm font-medium">{org.name}</p>
    </div>
  )
}

function SidebarFooter() {
  const user = useCurrentUser()
  if (!user) return null

  return (
    <div className="border-sidebar-border flex items-center gap-2.5 border-t px-3 py-3">
      <div className="bg-sidebar-accent grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase">
        {(user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sidebar-foreground truncate text-sm font-medium">
          {user.name ?? user.email}
        </p>
        <p className="text-muted-foreground truncate text-[11px]">
          {user.role.replace(/_/g, ' ').toLowerCase()}
        </p>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="bg-background flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-60 shrink-0 flex-col justify-between border-r md:flex">
        <div className="flex flex-col gap-3 pt-4">
          <div className="px-3">
            <Brand />
          </div>
          <OrgLine />
          <div className="px-2">
            <SidebarNav />
          </div>
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-6">
          <div className="flex items-center gap-2">
            {/* Mobile drawer trigger */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />
                }
              >
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col justify-between pt-4">
                  <div className="flex flex-col gap-3">
                    <div className="px-3">
                      <Brand />
                    </div>
                    <OrgLine />
                    <div className="px-2">
                      <SidebarNav onNavigate={() => setDrawerOpen(false)} />
                    </div>
                  </div>
                  <SidebarFooter />
                </div>
              </SheetContent>
            </Sheet>

            <span className="flex items-center gap-2 md:hidden">
              <BrandMark className="size-6" />
              <span className="text-sm font-semibold tracking-tight">SelectIQ</span>
            </span>
          </div>

          <UserMenu />
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}

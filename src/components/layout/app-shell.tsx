'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'

import SidebarNav from '@/components/layout/sidebar-nav'
import UserMenu from '@/components/layout/user-menu'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { useCurrentUser } from '@/lib/auth/user-context'
import { useActiveOrg } from '@/lib/org-context'

/**
 * Plan 008 — the authenticated app shell.
 *
 * Sidebar on the left, top bar across the content, scrollable main area.
 *
 * Responsiveness is CSS, not JavaScript: the sidebar is `hidden md:flex` and
 * the drawer trigger is `md:hidden`. Doing it by measuring the viewport in
 * state would mean the server renders one layout and the client swaps to
 * another, which flashes on every load.
 */

function Brand() {
  const org = useActiveOrg()
  return (
    <Link href={`/${org.slug}/dashboard`} className="flex items-center gap-2 px-3 py-1">
      <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
        S
      </span>
      <span className="text-sm font-semibold tracking-tight">SelectIQ</span>
    </Link>
  )
}

function SidebarFooter() {
  const user = useCurrentUser()
  if (!user) return null

  return (
    <div className="flex flex-col gap-2 px-3">
      <Separator />
      <div className="flex flex-col gap-1 py-1">
        <span className="truncate text-sm font-medium">{user.name ?? user.email}</span>
        <Badge variant="secondary" className="w-fit text-[10px]">
          {user.role.replace(/_/g, ' ')}
        </Badge>
      </div>
    </div>
  )
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="bg-sidebar hidden w-60 shrink-0 flex-col justify-between border-r py-4 md:flex">
        <div className="flex flex-col gap-4">
          <Brand />
          <div className="px-3">
            <SidebarNav />
          </div>
        </div>
        <SidebarFooter />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="flex items-center gap-2">
            {/* Mobile drawer */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />
                }
              >
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col justify-between py-4">
                  <div className="flex flex-col gap-4">
                    <Brand />
                    <div className="px-3">
                      <SidebarNav onNavigate={() => setDrawerOpen(false)} />
                    </div>
                  </div>
                  <SidebarFooter />
                </div>
              </SheetContent>
            </Sheet>

            <span className="text-sm font-semibold md:hidden">SelectIQ</span>
          </div>

          <UserMenu />
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

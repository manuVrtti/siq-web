'use client'

import { useState, useSyncExternalStore, type ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { BrandMark, BrandWordmark } from '@/components/brand/mark'
import NotificationBell from '@/components/layout/notification-bell'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import SidebarNav from '@/components/layout/sidebar-nav'
import UserMenu from '@/components/layout/user-menu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ROLE_LABEL, labelOf } from '@/constants/labels'
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
  const user = useCurrentUser()
  // A Super Admin isn't part of any college — inside one they are viewing
  // it from the platform, with a way back to the console.
  if (user?.role === 'SUPER_ADMIN') {
    return (
      <div className="px-3 pb-2">
        <p className="text-sidebar-muted text-[10px] font-medium uppercase tracking-wider">
          Viewing as Super Admin
        </p>
        <p className="text-sidebar-foreground truncate text-sm font-medium">{org.name}</p>
        <Link
          href="/admin"
          className="text-highlight hover:text-sidebar-foreground mt-1 inline-flex items-center gap-1 text-xs font-medium transition-colors"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Platform console
        </Link>
      </div>
    )
  }
  return (
    <div className="px-3 pb-2">
      <p className="text-sidebar-muted text-[10px] font-medium uppercase tracking-wider">
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
      <div className="bg-highlight text-highlight-foreground grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold uppercase">
        {(user.name?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sidebar-foreground truncate text-sm font-medium">
          {user.name ?? user.email}
        </p>
        <p className="text-sidebar-muted truncate text-[11px]">
          {labelOf(ROLE_LABEL, user.role)}
        </p>
      </div>
    </div>
  )
}

const SIDEBAR_KEY = 'siq:sidebar-collapsed'
const SIDEBAR_EVENT = 'siq-sidebar'

function readSidebar(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false // storage blocked: start expanded
  }
}
function writeSidebar(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  } catch {}
  window.dispatchEvent(new Event(SIDEBAR_EVENT))
}
function subscribeSidebar(cb: () => void) {
  window.addEventListener(SIDEBAR_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(SIDEBAR_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <NotificationProvider>
      <Shell>{children}</Shell>
    </NotificationProvider>
  )
}

function Shell({ children }: { children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  // Desktop only: hide the sidebar for more room. Remembered per browser;
  // the server snapshot is "expanded" so the first paint matches the default.
  const collapsed = useSyncExternalStore(subscribeSidebar, readSidebar, () => false)
  const toggleSidebar = () => writeSidebar(!collapsed)

  return (
    <div className="bg-background flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`siq-sidebar bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 hidden h-svh w-60 shrink-0 flex-col justify-between overflow-hidden border-r ${collapsed ? '' : 'md:flex'}`}
      >
        <div className="siq-sidebar-top flex min-h-0 flex-col gap-3 pt-4">
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
        <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 backdrop-blur-md shrink-0 items-center justify-between gap-3 border-b px-4 md:px-6">
          <div className="flex items-center gap-2">
            {/* Desktop sidebar toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={toggleSidebar}
              aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-5" aria-hidden />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden />
              )}
            </Button>

            {/* Mobile drawer trigger */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" />
                }
              >
                <Menu className="size-5" aria-hidden />
              </SheetTrigger>
              <SheetContent side="left" className="bg-sidebar text-sidebar-foreground w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="siq-sidebar flex h-full flex-col justify-between overflow-hidden pt-4">
                  <div className="siq-sidebar-top flex min-h-0 flex-col gap-3">
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

            <span className={`flex items-center gap-2 ${collapsed ? '' : 'md:hidden'}`}>
              <BrandMark className="size-6" />
              <span className="text-sm font-semibold tracking-tight">SelectIQ</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <UserMenu />
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-x-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}

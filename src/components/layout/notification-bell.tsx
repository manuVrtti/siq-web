'use client'

import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

import { NotificationItemBody } from '@/components/notifications/notification-item'
import { useNotifications } from '@/components/notifications/notification-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useActiveOrg } from '@/lib/org-context'

/**
 * Header bell (ABTalks NotificationBellButton + panel). Data lives in
 * NotificationProvider; opening the menu counts as seeing everything in it.
 */
export default function NotificationBell() {
  const { feed, failed, refresh, markRead } = useNotifications()
  const org = useActiveOrg()
  const router = useRouter()
  const unread = feed?.unreadCount ?? 0

  const go = (href: string | null) => {
    if (!href) return
    if (href.startsWith('https://')) window.open(href, '_blank', 'noopener,noreferrer')
    else router.push(href)
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return
        refresh()
        markRead()
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-full"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
          />
        }
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-semibold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        {/* Base UI: a label must sit inside a group (see user-menu.tsx). */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-foreground px-4 py-3 text-sm font-semibold">Notifications</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="m-0" />

        <div className="max-h-[60vh] overflow-y-auto">
          {!feed && !failed && <p className="text-muted-foreground px-4 py-8 text-center text-sm">Loading…</p>}
          {!feed && failed && (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">Couldn’t load notifications</p>
          )}
          {feed?.items.length === 0 && (
            <p className="text-muted-foreground px-4 py-8 text-center text-sm">You’re all caught up.</p>
          )}
          {feed?.items.map((item) => (
            <DropdownMenuItem
              key={item.key}
              onClick={() => go(item.href)}
              className="rounded-none px-4 py-3"
            >
              <NotificationItemBody item={item} />
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          onClick={() => router.push(`/${org.slug}/notifications`)}
          className="text-primary justify-center rounded-none py-2.5 text-sm font-medium"
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCheck } from 'lucide-react'

import { NotificationItemBody } from '@/components/notifications/notification-item'
import { useNotifications } from '@/components/notifications/notification-provider'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AppNotification } from '@/services/notifications/types'

/** Full notification feed with mark-read. */
export function NotificationsCenter({ initialItems }: { initialItems: AppNotification[] }) {
  const { markRead } = useNotifications()
  const [items, setItems] = useState(initialItems)
  const unread = items.filter((i) => !i.isRead)

  function markAll() {
    const keys = unread.map((i) => i.key)
    if (keys.length === 0) return
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })))
    // Keeps the bell's badge in step; the provider also persists the write.
    markRead(keys)
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: keys.slice(0, 50) }),
    }).catch(() => {})
  }

  function markOne(key: string) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, isRead: true } : i)))
    markRead([key])
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys: [key] }),
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="feed-h" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="feed-h" className="text-base font-semibold">
            Recent {unread.length > 0 && <span className="text-muted-foreground font-normal">· {unread.length} unread</span>}
          </h2>
          <Button variant="outline" size="sm" onClick={markAll} disabled={unread.length === 0}>
            <CheckCheck className="size-3.5" aria-hidden />
            Mark all read
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="siq-card text-muted-foreground p-8 text-center text-sm">You’re all caught up.</p>
        ) : (
          <ul className="siq-card divide-y overflow-hidden">
            {items.map((item) => {
              const row = <NotificationItemBody item={item} wrap />
              const cls = cn('flex px-4 py-3 transition-colors', item.href && 'hover:bg-muted/60')
              return (
                <li key={item.key}>
                  {item.href?.startsWith('https://') ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => markOne(item.key)}>
                      {row}
                    </a>
                  ) : item.href ? (
                    <Link href={item.href} className={cls} onClick={() => markOne(item.key)}>
                      {row}
                    </Link>
                  ) : (
                    <div className={cls}>{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

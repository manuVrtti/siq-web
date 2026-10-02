import { Bell, ClipboardCheck, FileText, Megaphone, PlayCircle, type LucideIcon } from 'lucide-react'

import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AppNotification, NotificationCategoryKey } from '@/services/notifications/types'

const ICON: Record<NotificationCategoryKey, LucideIcon> = {
  GENERAL: Megaphone,
  ASSESSMENT: PlayCircle,
  RESULT: FileText,
  REVIEW: ClipboardCheck,
  SYSTEM: Bell,
}

/** One notification row — shared by the bell panel and the Notifications page. */
export function NotificationItemBody({ item, wrap = false }: { item: AppNotification; wrap?: boolean }) {
  const Icon = ICON[item.category] ?? Megaphone
  return (
    <div className="flex min-w-0 flex-1 gap-3">
      <span
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border',
          item.isRead ? 'border-border text-muted-foreground' : 'border-primary/30 bg-primary/10 text-primary',
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm leading-snug', item.isRead ? 'font-medium' : 'font-semibold', !wrap && 'truncate')}>
          {item.title}
        </p>
        {item.body && (
          <p className={cn('text-muted-foreground mt-0.5 text-xs', !wrap && 'line-clamp-2')}>{item.body}</p>
        )}
        <p className="text-muted-foreground mt-1 text-[11px]">{timeAgo(new Date(item.publishedAt))}</p>
      </div>
      {!item.isRead && <span className="bg-primary mt-2 size-2 shrink-0 rounded-full" aria-label="Unread" />}
    </div>
  )
}

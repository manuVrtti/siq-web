/**
 * Notification shapes shared by server and client.
 *
 * Imported by Client Components, so this file must stay free of
 * `server-only`, `@prisma/client` and any runtime import.
 */

export type NotificationCategoryKey = 'GENERAL' | 'ASSESSMENT' | 'RESULT' | 'REVIEW' | 'SYSTEM'

export type AppNotification = {
  /**
   * Stable, unique, never reused — it is what NotificationRead stores.
   *   "admin:<id>"                   broadcast announcement
   *   "user:<id>"                    personal (UserNotification)
   *   "open:<assignmentId>"          derived: a test open to take
   *   "review:<assessmentId>:<ms>"   derived: answers awaiting review
   */
  key: string
  title: string
  body: string | null
  href: string | null
  category: NotificationCategoryKey
  /** ISO string — already serialised for the client boundary. */
  publishedAt: string
  isRead: boolean
}

export type NotificationFeed = {
  items: AppNotification[]
  unreadCount: number
}

export const EMPTY_FEED: NotificationFeed = { items: [], unreadCount: 0 }

export const PERSONAL_KEY_PREFIX = 'user:'
export const ANNOUNCEMENT_KEY_PREFIX = 'admin:'

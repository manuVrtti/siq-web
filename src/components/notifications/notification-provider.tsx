'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { useCurrentUser } from '@/lib/auth/user-context'
import { useActiveOrg } from '@/lib/org-context'
import type { NotificationFeed } from '@/services/notifications/types'

/**
 * One owner for the bell's data (ABTalks plan 067 §3b): the feed, the unread
 * count and a short sessionStorage cache. The bell and the Notifications page
 * both read it, so marking read in one clears the badge in the other.
 *
 *   - loads once per workspace, then refetches when the tab regains focus
 *     and the cache is older than REFETCH_AFTER_MS (ABTalks plan 153)
 *   - opening the bell marks everything in it read — optimistic, the write
 *     is fire-and-forget
 */

type Ctx = {
  feed: NotificationFeed | null
  failed: boolean
  /** Refetch now, ignoring the cache. */
  refresh: () => void
  /** Optimistically mark these keys (default: every unread item) read. */
  markRead: (keys?: string[]) => void
}

const NotificationContext = createContext<Ctx | null>(null)

const TTL_MS = 20_000
const REFETCH_AFTER_MS = 10_000

type Cached = { feed: NotificationFeed; t: number }

function readCache(key: string): Cached | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Cached) : null
  } catch {
    return null
  }
}
function writeCache(key: string, feed: NotificationFeed) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ feed, t: Date.now() }))
  } catch {}
}
/** Null, future (clock drift) or old timestamps all count as stale. */
function isStale(t: number | undefined, maxAge: number): boolean {
  if (t == null) return true
  const age = Date.now() - t
  return age < 0 || age > maxAge
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const user = useCurrentUser()
  const org = useActiveOrg()
  const cacheKey = `siq:notifications:${user?.id ?? 'anon'}:${org.slug}`

  const [feed, setFeed] = useState<NotificationFeed | null>(null)
  const [failed, setFailed] = useState(false)
  const loading = useRef(false)

  const fetchFeed = useCallback(() => {
    if (loading.current) return
    loading.current = true
    fetch(`/api/notifications?org=${encodeURIComponent(org.slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) throw new Error()
        setFeed(json.data)
        setFailed(false)
        writeCache(cacheKey, json.data)
      })
      .catch(() => setFailed(true))
      .finally(() => {
        loading.current = false
      })
  }, [org.slug, cacheKey])

  // First load per workspace: paint from cache, refetch if it's old.
  useEffect(() => {
    if (!user) return
    const cached = readCache(cacheKey)
    if (cached) queueMicrotask(() => setFeed(cached.feed))
    if (isStale(cached?.t, TTL_MS)) fetchFeed()
  }, [user, cacheKey, fetchFeed])

  // Pick up notifications created while the tab was in the background.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isStale(readCache(cacheKey)?.t, REFETCH_AFTER_MS)) fetchFeed()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [cacheKey, fetchFeed])

  const markRead = useCallback(
    (keys?: string[]) => {
      setFeed((prev) => {
        if (!prev) return prev
        const target = new Set(keys ?? prev.items.filter((i) => !i.isRead).map((i) => i.key))
        const unread = prev.items.filter((i) => !i.isRead && target.has(i.key)).map((i) => i.key)
        if (unread.length === 0) return prev
        const items = prev.items.map((i) => (target.has(i.key) ? { ...i, isRead: true } : i))
        const next = { items, unreadCount: items.filter((i) => !i.isRead).length }
        writeCache(cacheKey, next)
        void fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: unread.slice(0, 50) }),
        }).catch(() => {})
        return next
      })
    },
    [cacheKey],
  )

  const value = useMemo(() => ({ feed, failed, refresh: fetchFeed, markRead }), [feed, failed, fetchFeed, markRead])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

const NOOP: Ctx = { feed: null, failed: false, refresh: () => {}, markRead: () => {} }

export function useNotifications(): Ctx {
  return useContext(NotificationContext) ?? NOOP
}

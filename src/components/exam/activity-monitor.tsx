'use client'

import { useEffect, useState } from 'react'

import { useActivityMonitor } from '@/hooks/use-activity-monitor'
import { initActivitySession, postActivityFlag } from '@/lib/proctoring/activity'

/**
 * Plan 018b — activity tracking for an exam WITHOUT camera proctoring.
 * Opens an activity-only session, then logs tab switches, copy / paste,
 * screenshot attempts and the rest for the college to review. Renders a
 * small notice so the student knows the exam is monitored.
 */
export default function ActivityMonitor({ token }: { token: string }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    void initActivitySession(token).then((ok) => {
      if (alive) setReady(ok)
    })
    return () => {
      alive = false
    }
  }, [token])

  useActivityMonitor({
    enabled: ready,
    onFlag: (type, metadata) => void postActivityFlag(token, type, metadata),
  })

  return (
    <p className="text-muted-foreground fixed right-4 bottom-4 z-40 rounded-full border bg-white/80 px-3 py-1 text-[11px] shadow-sm backdrop-blur dark:bg-black/40">
      Activity is monitored · copy, paste and screenshots are blocked
    </p>
  )
}

'use client'

import { useEffect, useRef } from 'react'

/**
 * Plan 018 — client-side activity monitor.
 *
 * Wires DOM lifecycle events (tab visibility, window focus, fullscreen) to a
 * single `onFlag` callback. Events are debounced so a quick blur → focus
 * bounce (common on macOS when a notification appears) does not fire twice.
 *
 * The monitor never uploads on its own; the parent decides whether the flag
 * warrants a POST. This keeps this hook cheap enough to leave mounted for
 * the whole exam even when proctoring is off.
 */

const DEBOUNCE_MS = 500

export type ActivityFlagType =
  | 'TAB_SWITCH'
  | 'FOCUS_LOSS'
  | 'FULLSCREEN_EXIT'
  | 'WINDOW_BLUR'

export function useActivityMonitor({
  enabled,
  onFlag,
}: {
  enabled: boolean
  onFlag: (type: ActivityFlagType, metadata?: Record<string, unknown>) => void
}) {
  // Ref to keep the effect body stable across re-renders — otherwise every
  // onFlag identity change would rebind listeners. Sync inside a no-dep
  // effect so we don't touch the ref during render.
  const onFlagRef = useRef(onFlag)
  useEffect(() => {
    onFlagRef.current = onFlag
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let lastFire = 0
    const fire = (type: ActivityFlagType, metadata?: Record<string, unknown>) => {
      const now = Date.now()
      if (now - lastFire < DEBOUNCE_MS) return
      lastFire = now
      onFlagRef.current(type, metadata)
    }

    let blurAt = 0
    const onBlur = () => {
      blurAt = Date.now()
      fire('WINDOW_BLUR')
    }
    const onFocus = () => {
      if (blurAt) {
        fire('FOCUS_LOSS', { durationMs: Date.now() - blurAt })
        blurAt = 0
      }
    }
    const onVisibility = () => {
      // 'hidden' fires when the tab is switched, minimized, or the OS lock
      // screen appears — all worth logging as TAB_SWITCH.
      if (document.visibilityState === 'hidden') fire('TAB_SWITCH')
    }
    const onFullscreen = () => {
      if (!document.fullscreenElement) fire('FULLSCREEN_EXIT')
    }

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)

    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [enabled])
}

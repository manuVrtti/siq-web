'use client'

import { useEffect, useRef } from 'react'

/**
 * Plans 018 / 018b — client-side activity monitor, mounted on EVERY exam.
 *
 * Watches the page for things a proctor would want to know and hands each
 * to `onFlag`; the parent posts it. Recorded:
 *   tab switch · window blur / focus loss (with duration) · fullscreen exit
 *   copy / cut / paste / right-click — also BLOCKED during the exam
 *   PrintScreen key — a screenshot attempt
 *   events forwarded by the SelectIQ exam browser (blocked shortcuts,
 *   second screen, OS-level screenshot) via window.postMessage
 *
 * Debounced per type, so one long absence or a held key isn't a flood.
 */

const DEBOUNCE_MS = 1500

export type ActivityFlagType =
  | 'TAB_SWITCH'
  | 'FOCUS_LOSS'
  | 'FULLSCREEN_EXIT'
  | 'WINDOW_BLUR'
  | 'COPY'
  | 'CUT'
  | 'PASTE'
  | 'CONTEXT_MENU'
  | 'SCREENSHOT_ATTEMPT'
  | 'SHORTCUT_BLOCKED'
  | 'SECOND_SCREEN'
  | 'BLOCKED_APP'

/** Events the exam browser may forward into the page. */
const SHELL_EVENTS: Record<string, ActivityFlagType> = {
  'screenshot-attempt': 'SCREENSHOT_ATTEMPT',
  'shortcut-blocked': 'SHORTCUT_BLOCKED',
  'second-screen': 'SECOND_SCREEN',
  'tab-switch': 'TAB_SWITCH',
  'window-blur': 'WINDOW_BLUR',
  'blocked-app': 'BLOCKED_APP',
}

/** Origins the exam browser's own UI runs on (packaged app / its dev server). */
const SHELL_ORIGINS = ['app://-', 'http://localhost:5173']

export function useActivityMonitor({
  enabled,
  onFlag,
}: {
  enabled: boolean
  onFlag: (type: ActivityFlagType, metadata?: Record<string, unknown>) => void
}) {
  const onFlagRef = useRef(onFlag)
  useEffect(() => {
    onFlagRef.current = onFlag
  })

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const last = new Map<ActivityFlagType, number>()
    const fire = (type: ActivityFlagType, metadata?: Record<string, unknown>) => {
      const now = Date.now()
      if (now - (last.get(type) ?? 0) < DEBOUNCE_MS) return
      last.set(type, now)
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
      if (document.visibilityState === 'hidden') fire('TAB_SWITCH')
    }
    const onFullscreen = () => {
      if (!document.fullscreenElement) fire('FULLSCREEN_EXIT')
    }
    // Clipboard + right-click: blocked during the exam, and logged.
    const block = (type: ActivityFlagType) => (e: Event) => {
      e.preventDefault()
      fire(type)
    }
    const onCopy = block('COPY')
    const onCut = block('CUT')
    const onPaste = block('PASTE')
    const onContext = block('CONTEXT_MENU')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen') fire('SCREENSHOT_ATTEMPT', { key: 'PrintScreen' })
    }
    const onShell = (e: MessageEvent) => {
      if (e.source !== window.parent || window.parent === window) return
      if (!SHELL_ORIGINS.includes(e.origin)) return
      const data = e.data as { source?: string; type?: string; details?: Record<string, unknown> } | null
      if (data?.source !== 'selectiq-shell' || typeof data.type !== 'string') return
      const type = SHELL_EVENTS[data.type]
      if (type) fire(type, { from: 'exam-browser', ...(data.details ?? {}) })
    }

    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    document.addEventListener('fullscreenchange', onFullscreen)
    document.addEventListener('copy', onCopy)
    document.addEventListener('cut', onCut)
    document.addEventListener('paste', onPaste)
    document.addEventListener('contextmenu', onContext)
    window.addEventListener('keyup', onKey)
    window.addEventListener('message', onShell)

    return () => {
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('fullscreenchange', onFullscreen)
      document.removeEventListener('copy', onCopy)
      document.removeEventListener('cut', onCut)
      document.removeEventListener('paste', onPaste)
      document.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('message', onShell)
    }
  }, [enabled])
}

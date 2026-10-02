import type { ActivityFlagType } from '@/hooks/use-activity-monitor'

/**
 * Plan 018b — how serious each activity is, and the one function that posts
 * a flag. Shared by the activity-only monitor and the camera monitor.
 */

export const ACTIVITY_SEVERITY: Record<ActivityFlagType, 'LOW' | 'MEDIUM' | 'HIGH'> = {
  TAB_SWITCH: 'MEDIUM',
  FOCUS_LOSS: 'LOW',
  WINDOW_BLUR: 'LOW',
  FULLSCREEN_EXIT: 'MEDIUM',
  COPY: 'MEDIUM',
  CUT: 'MEDIUM',
  PASTE: 'MEDIUM',
  CONTEXT_MENU: 'LOW',
  SCREENSHOT_ATTEMPT: 'HIGH',
  SHORTCUT_BLOCKED: 'LOW',
  SECOND_SCREEN: 'HIGH',
  BLOCKED_APP: 'HIGH',
}

/** Start (or resume) the attempt's activity session. Safe to call repeatedly. */
export async function initActivitySession(token: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/exam/${token}/proctoring/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return res.ok
  } catch {
    return false
  }
}

export async function postActivityFlag(token: string, type: ActivityFlagType, metadata?: Record<string, unknown>) {
  try {
    await fetch(`/api/exam/${token}/proctoring/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, severity: ACTIVITY_SEVERITY[type], metadata: metadata ?? null }),
    })
  } catch {
    // Offline for a moment — losing one activity flag is acceptable.
  }
}

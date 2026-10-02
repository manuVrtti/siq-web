/**
 * Plan 018b — one rule for how worrying an attempt looks, used by the grade
 * page panel, the mock-drive monitor and the results list. Pure.
 *
 *   HIGH   — identity mismatch, or any HIGH flag (other person / different
 *            face / screenshot attempt / second screen / camera denied),
 *            or 5+ tab switches
 *   REVIEW — anything else worth a look (tab switch, copy-paste, no face,
 *            fullscreen exit, …)
 *   CLEAR  — nothing recorded
 */

export type Risk = 'CLEAR' | 'REVIEW' | 'HIGH'

export const FLAG_LABEL: Record<string, string> = {
  TAB_SWITCH: 'Tab / app switch',
  WINDOW_BLUR: 'Left the exam window',
  FOCUS_LOSS: 'Away from the exam',
  FULLSCREEN_EXIT: 'Exited full screen',
  COPY: 'Copy attempt',
  CUT: 'Cut attempt',
  PASTE: 'Paste attempt',
  CONTEXT_MENU: 'Right-click',
  SCREENSHOT_ATTEMPT: 'Screenshot attempt',
  SHORTCUT_BLOCKED: 'Blocked shortcut',
  SECOND_SCREEN: 'Second screen',
  NO_FACE: 'No face in camera',
  MULTIPLE_FACES: 'Another person in camera',
  FACE_MISMATCH: 'Different face',
  IDENTITY_MISMATCH: 'Identity not confirmed',
  WEBCAM_DENIED: 'Camera turned off / denied',
  BLOCKED_APP: 'Blocked app (closed by the exam browser)',
}

/** Display groups for the counts grid (order = importance). */
export const FLAG_GROUPS: { label: string; types: string[] }[] = [
  { label: 'Other person in camera', types: ['MULTIPLE_FACES'] },
  { label: 'Different face', types: ['FACE_MISMATCH', 'IDENTITY_MISMATCH'] },
  { label: 'Screenshot attempts', types: ['SCREENSHOT_ATTEMPT'] },
  { label: 'Blocked apps closed', types: ['BLOCKED_APP'] },
  { label: 'Tab / window switches', types: ['TAB_SWITCH', 'WINDOW_BLUR'] },
  { label: 'Copy / cut / paste', types: ['COPY', 'CUT', 'PASTE'] },
  { label: 'No face in camera', types: ['NO_FACE'] },
  { label: 'Exited full screen', types: ['FULLSCREEN_EXIT'] },
  { label: 'Right-clicks', types: ['CONTEXT_MENU'] },
  { label: 'Second screen', types: ['SECOND_SCREEN'] },
  { label: 'Blocked shortcuts', types: ['SHORTCUT_BLOCKED'] },
  { label: 'Camera denied', types: ['WEBCAM_DENIED'] },
]

export function assessRisk(input: {
  flags: { type: string; severity: string }[]
  identityOutcome?: string | null
  checksFailed?: number
}): Risk {
  if (input.identityOutcome === 'MISMATCH') return 'HIGH'
  if (input.flags.some((f) => f.severity === 'HIGH')) return 'HIGH'
  if ((input.checksFailed ?? 0) > 0) return 'HIGH'
  if (input.flags.filter((f) => f.type === 'TAB_SWITCH').length >= 5) return 'HIGH'
  const noise = new Set(['FOCUS_LOSS', 'SHORTCUT_BLOCKED'])
  if (input.flags.some((f) => !noise.has(f.type))) return 'REVIEW'
  return 'CLEAR'
}

export const RISK_STYLE: Record<Risk, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  CLEAR: { label: 'Clear', tone: 'success' },
  REVIEW: { label: 'Review', tone: 'warning' },
  HIGH: { label: 'High risk', tone: 'danger' },
}

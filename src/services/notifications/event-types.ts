import type { NotificationCategoryKey } from './types'

/**
 * Every personal notification type. Stored as a String (not an enum), so
 * adding one needs no migration — but a shipped key is never renamed.
 */
export type EventTypeConfig = {
  key: string
  label: string
  category: NotificationCategoryKey
}

export const EVENT_TYPE_REGISTRY = {
  'assessment.assigned': { key: 'assessment.assigned', label: 'New test assigned', category: 'ASSESSMENT' },
  'result.graded': { key: 'result.graded', label: 'Result ready', category: 'RESULT' },
} as const satisfies Record<string, EventTypeConfig>

export type EventType = keyof typeof EVENT_TYPE_REGISTRY

export function isValidEventType(type: string): type is EventType {
  return type in EVENT_TYPE_REGISTRY
}

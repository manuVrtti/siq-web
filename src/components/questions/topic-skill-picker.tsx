'use client'

import { cn } from '@/lib/utils'

/**
 * Plan 021 — pick one topic, then one or more skills under it.
 * Shared by the question form and the tagging queue.
 */

export type TaxonomyTopic = {
  id: string
  name: string
  code: string
  platform: boolean
  skills: { id: string; name: string; platform: boolean }[]
}

const fieldClass =
  'w-full rounded-md border border-current/20 bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-current/50'

export default function TopicSkillPicker({
  topics,
  topicId,
  skillIds,
  onChange,
  compact = false,
}: {
  topics: TaxonomyTopic[]
  topicId: string
  skillIds: string[]
  onChange: (next: { topicId: string; skillIds: string[] }) => void
  compact?: boolean
}) {
  const topic = topics.find((t) => t.id === topicId)

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
      <select
        className={fieldClass}
        value={topicId}
        aria-label="Topic"
        // Skills belong to one topic, so switching topic clears them.
        onChange={(e) => onChange({ topicId: e.target.value, skillIds: [] })}
      >
        <option value="">Choose a topic…</option>
        {topics.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.platform ? '' : ' (this college)'}
          </option>
        ))}
      </select>

      {topic && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Skills">
          {topic.skills.map((s) => {
            const on = skillIds.includes(s.id)
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({ topicId, skillIds: on ? skillIds.filter((x) => x !== s.id) : [...skillIds, s.id] })
                }
                className={cn(
                  'rounded-full border px-3 py-1 text-xs transition-all duration-150 active:scale-95',
                  on
                    ? 'border-transparent bg-primary text-primary-foreground shadow-sm'
                    : 'border-current/20 hover:border-current/40',
                )}
              >
                {s.name}
              </button>
            )
          })}
          {topic.skills.length === 0 && (
            <span className="text-muted-foreground text-xs">
              This topic has no skills yet — a College Admin can add them under Question bank → Topics &amp; skills.
            </span>
          )}
        </div>
      )}
    </div>
  )
}

import type { QuestionStat } from '@/services/analytics/question-analytics'
import { cn } from '@/lib/utils'

/**
 * Plan 019 — per-question quality table: difficulty as an inline bar, plus a
 * discrimination rating an evaluator can act on. A table beats a chart here:
 * the reader wants to find *which* question is broken, which needs its title.
 */
export function QuestionDifficultyChart({ questions }: { questions: QuestionStat[] }) {
  if (questions.length === 0) {
    return <p className="text-muted-foreground text-sm">This assessment has no questions.</p>
  }
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-xs">
            <th className="px-5 py-2 font-medium">#</th>
            <th className="py-2 font-medium">Question</th>
            <th className="py-2 font-medium">Difficulty</th>
            <th className="py-2 text-right font-medium">Avg marks</th>
            <th className="px-5 py-2 text-right font-medium">Discrimination</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q, i) => (
            <tr key={q.questionId} className="hover:bg-muted/40 border-b last:border-0">
              <td className="text-muted-foreground siq-numeric px-5 py-2.5 align-top">{i + 1}</td>
              <td className="max-w-[260px] py-2.5 pr-4 align-top">
                <p className="truncate font-medium">{q.title}</p>
                <p className="text-muted-foreground text-xs">
                  {q.type.replace(/_/g, ' ').toLowerCase()} · {q.responses} response
                  {q.responses === 1 ? '' : 's'}
                </p>
              </td>
              <td className="w-44 py-2.5 pr-4 align-top">
                <DifficultyBar value={q.difficulty} />
              </td>
              <td className="siq-numeric py-2.5 text-right align-top">
                {q.avgScore === null ? '—' : `${q.avgScore} / ${q.maxMarks}`}
              </td>
              <td className="px-5 py-2.5 text-right align-top">
                <DiscriminationBadge value={q.discrimination} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DifficultyBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-xs">No data</span>
  const pct = Math.round(value * 100)
  const label = pct >= 80 ? 'easy' : pct >= 40 ? 'moderate' : 'hard'
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="siq-numeric w-9 text-right text-xs">{pct}%</span>
      <span className="text-muted-foreground w-14 text-xs">{label}</span>
    </div>
  )
}

function DiscriminationBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground text-xs" title="Needs at least 5 graded responses">
        n/a
      </span>
    )
  }
  const tier =
    value < 0 ? 'negative' : value < 0.1 ? 'poor' : value < 0.3 ? 'fair' : 'good'
  return (
    <span
      className={cn(
        'siq-numeric inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        tier === 'good' && 'bg-success/10 text-success',
        tier === 'fair' && 'bg-accent text-accent-foreground',
        tier === 'poor' && 'bg-warning/10 text-warning',
        tier === 'negative' && 'bg-destructive/10 text-destructive',
      )}
      title={
        tier === 'negative'
          ? 'Weaker candidates score better here — check the answer key'
          : undefined
      }
    >
      {value.toFixed(2)} · {tier}
    </span>
  )
}

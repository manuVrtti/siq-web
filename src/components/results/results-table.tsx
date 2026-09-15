import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { PassBadge, ResultStatusBadge, formatScore } from '@/components/results/score-badge'

type Row = {
  id: string
  status: 'PENDING_REVIEW' | 'GRADED'
  totalScore: number
  maxScore: number
  percentage: number
  passed: boolean | null
  user: { id: string; name: string | null; email: string | null }
}

/**
 * Plan 016 — admin listing of everyone who took one assessment.
 * Each row links to the manual-grade page for that Result.
 */
export function ResultsTable({ rows, gradeHref }: { rows: Row[]; gradeHref: (id: string) => string }) {
  return (
    <Card>
      <div className="divide-y">
        <div className="text-muted-foreground grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 text-xs uppercase tracking-wide">
          <span>Candidate</span>
          <span className="text-right">Score</span>
          <span className="text-right">Status</span>
          <span />
        </div>
        {rows.map((r) => (
          <Link
            key={r.id}
            href={gradeHref(r.id)}
            className="hover:bg-muted/40 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-3 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{r.user.name ?? '—'}</p>
              <p className="text-muted-foreground truncate text-xs">{r.user.email ?? ''}</p>
            </div>
            <div className="text-right tabular-nums">
              {formatScore(r.totalScore)} / {formatScore(r.maxScore)}
              {r.status === 'GRADED' ? (
                <span className="text-muted-foreground ml-2 text-xs">
                  {r.percentage.toFixed(0)}%
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1">
              <ResultStatusBadge status={r.status} />
              <PassBadge passed={r.passed} status={r.status} />
            </div>
            <span className="text-muted-foreground text-xs">→</span>
          </Link>
        ))}
      </div>
    </Card>
  )
}

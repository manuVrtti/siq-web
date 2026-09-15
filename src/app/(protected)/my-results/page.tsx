import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText } from 'lucide-react'

import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import PageHeader from '@/components/ui/page-header'
import { PassBadge, ResultStatusBadge, formatScore } from '@/components/results/score-badge'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { listResultsForCandidate } from '@/services/grading'

export const metadata: Metadata = { title: 'My results — SelectIQ' }

/**
 * Plan 016 — the signed-in candidate's completed exams across every org
 * they belong to. Rendered without the org shell because results are the
 * candidate's, not tenant-scoped.
 */
export default async function MyResultsPage() {
  const user = (await getCurrentUser())!
  const results = await listResultsForCandidate(user.id)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6">
      <PageHeader
        title="My results"
        description={`${results.length} exam${results.length === 1 ? '' : 's'}`}
      />

      {results.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No results yet"
          description="Results appear here once you submit an exam."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((r) => (
            <Link key={r.id} href={`/my-results/${r.id}`} className="block">
              <Card className="transition-colors hover:border-current/30">
                <CardHeader className="gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ResultStatusBadge status={r.status} />
                    <PassBadge passed={r.passed} status={r.status} />
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatScore(r.totalScore)} / {formatScore(r.maxScore)}
                      {r.status === 'GRADED' ? ` · ${r.percentage.toFixed(1)}%` : ''}
                    </span>
                  </div>
                  <CardTitle className="text-base font-medium">
                    {r.assessment.title}
                  </CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}

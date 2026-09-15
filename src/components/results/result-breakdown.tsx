import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatScore } from '@/components/results/score-badge'

type BreakdownItem = {
  id: string
  questionId: string
  scoreAwarded: number
  maxMarks: number
  isCorrect: boolean | null
  needsReview: boolean
  feedback: string | null
  question: { title: string; type: string } | null
}

/**
 * Plan 016 — per-question breakdown shown on the candidate + admin detail views.
 * Renders the reviewer's feedback when present and marks the row's state
 * (correct / incorrect / pending review) with a badge.
 */
export function ResultBreakdown({ items }: { items: BreakdownItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((qr, index) => {
        const label = qr.question?.title ?? `Question ${index + 1}`
        return (
          <Card key={qr.id}>
            <CardHeader className="gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-xs">
                  Q{index + 1}
                  {qr.question?.type ? ` · ${qr.question.type}` : ''}
                </span>
                <StatusPill qr={qr} />
                <span className="text-muted-foreground ml-auto text-xs">
                  {formatScore(qr.scoreAwarded)} / {formatScore(qr.maxMarks)}
                </span>
              </div>
              <CardTitle className="text-base font-medium">{label}</CardTitle>
            </CardHeader>
            {qr.feedback ? (
              <CardContent>
                <p className="text-muted-foreground text-xs uppercase tracking-wide">
                  Reviewer feedback
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap">{qr.feedback}</p>
              </CardContent>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}

function StatusPill({ qr }: { qr: BreakdownItem }) {
  if (qr.needsReview) return <Badge variant="outline">pending review</Badge>
  if (qr.isCorrect === true) return <Badge variant="secondary">correct</Badge>
  if (qr.isCorrect === false) return <Badge variant="outline">incorrect</Badge>
  return <Badge variant="outline">partial</Badge>
}

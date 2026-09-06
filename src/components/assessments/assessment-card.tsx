import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

export type AssessmentCardData = {
  id: string
  title: string
  status: string
  durationMinutes: number
  sections: { questions: unknown[] }[]
}

const STATUS_VARIANT: Record<string, 'secondary' | 'outline'> = {
  DRAFT: 'outline',
  PUBLISHED: 'secondary',
  ARCHIVED: 'outline',
}

export default function AssessmentCard({
  orgSlug,
  assessment,
}: {
  orgSlug: string
  assessment: AssessmentCardData
}) {
  const questions = assessment.sections.reduce((n, s) => n + s.questions.length, 0)
  return (
    <Link href={`/${orgSlug}/assessments/${assessment.id}/build`} className="block">
      <Card className="transition-colors hover:border-current/30">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={STATUS_VARIANT[assessment.status] ?? 'outline'}>
              {assessment.status.toLowerCase()}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {assessment.durationMinutes} min · {assessment.sections.length} section
              {assessment.sections.length === 1 ? '' : 's'} · {questions} question
              {questions === 1 ? '' : 's'}
            </span>
          </div>
          <CardTitle className="text-base font-medium">{assessment.title}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  )
}

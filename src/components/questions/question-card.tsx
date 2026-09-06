import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Plan 011 — a question as it appears in the bank list.
 */
export type QuestionCardData = {
  id: string
  type: string
  title: string
  difficulty: string
  marks: number
  tags: { tag: { id: string; name: string } }[]
}

const TYPE_LABEL: Record<string, string> = {
  MCQ_SINGLE: 'MCQ',
  MCQ_MULTI: 'Multi-select',
  TRUE_FALSE: 'True/False',
  SUBJECTIVE: 'Subjective',
  CODING: 'Coding',
}

const DIFFICULTY_VARIANT: Record<string, 'secondary' | 'outline'> = {
  EASY: 'secondary',
  MEDIUM: 'outline',
  HARD: 'outline',
}

export default function QuestionCard({ question }: { question: QuestionCardData }) {
  return (
    <Link href={`/questions/${question.id}/edit`} className="block">
      <Card className="transition-colors hover:border-current/30">
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{TYPE_LABEL[question.type] ?? question.type}</Badge>
            <Badge variant={DIFFICULTY_VARIANT[question.difficulty] ?? 'outline'}>
              {question.difficulty.toLowerCase()}
            </Badge>
            <span className="text-muted-foreground text-xs">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </span>
          </div>
          <CardTitle className="text-base font-medium">{question.title}</CardTitle>
        </CardHeader>
        {question.tags.length > 0 && (
          <CardContent className="flex flex-wrap gap-1.5 pt-0">
            {question.tags.map(({ tag }) => (
              <Badge key={tag.id} variant="outline" className="text-[10px]">
                {tag.name}
              </Badge>
            ))}
          </CardContent>
        )}
      </Card>
    </Link>
  )
}

import { Badge } from '@/components/ui/badge'

/**
 * Plan 016 — status/pass badge used across candidate + admin views.
 */
export function ResultStatusBadge({ status }: { status: string }) {
  const isGraded = status === 'GRADED'
  return (
    <Badge variant={isGraded ? 'secondary' : 'outline'}>
      {isGraded ? 'graded' : 'pending review'}
    </Badge>
  )
}

export function PassBadge({ passed, status }: { passed: boolean | null; status: string }) {
  if (status !== 'GRADED') return null
  if (passed === null) return null
  return (
    <Badge variant={passed ? 'secondary' : 'outline'}>
      {passed ? 'passed' : 'not passed'}
    </Badge>
  )
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

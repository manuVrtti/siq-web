import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'

import { AssessmentsBoard, type BoardItem } from '@/components/student/assessments-board'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getStudentAssessments } from '@/services/analytics/candidate-analytics'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Assessments — SelectIQ' }

/**
 * Student Assessments tab. Shows only the signed-in user's own assignments
 * in this org, so org membership (checked by [org]/layout) is the only gate.
 */
export default async function MyAssessmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const [{ org: slug }, { tab }] = await Promise.all([params, searchParams])
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user) notFound()

  const a = await getStudentAssessments(org.id, user.id)
  const iso = (d: Date | null) => d?.toISOString() ?? null
  const items: BoardItem[] = [...a.inProgress, ...a.open, ...a.upcoming, ...a.done, ...a.missed].map((x) => ({
    id: x.id,
    token: x.token,
    bucket: x.bucket,
    title: x.title,
    description: x.description,
    durationMinutes: x.durationMinutes,
    questions: x.questions,
    startAt: iso(x.startAt),
    endAt: iso(x.endAt),
    submittedAt: iso(x.submittedAt),
    result: x.result,
  }))

  const todo = a.inProgress.length + a.open.length
  const subtitle =
    a.total === 0
      ? `Exams assigned to you at ${org.name} will appear here.`
      : todo > 0
        ? `${todo} waiting for you · ${a.done.length} completed`
        : `You're all caught up · ${a.done.length} completed`

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageIntro icon={ClipboardCheck} title="Assessments" subtitle={subtitle} />
      <AssessmentsBoard items={items} nowIso={new Date().toISOString()} initialTab={tab} />
    </div>
  )
}

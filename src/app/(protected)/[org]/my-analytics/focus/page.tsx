import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Target } from 'lucide-react'

import { FocusAreas } from '@/components/competency/strengths-weaknesses'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getStudentCompetencyView } from '@/services/competency/student-view'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Focus areas — SelectIQ' }

/** Plan 027 — every recommendation, in priority order. Own data only. */
export default async function FocusPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user) notFound()

  const view = await getStudentCompetencyView(user.id, org.id)
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Link href={`/${slug}/my-analytics`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Analytics
      </Link>
      <PageIntro icon={Target} title="Focus areas" subtitle="Ranked by how much each one matters for placements and how far it is from where it should be." />
      <FocusAreas view={view} slug={slug} limit={50} />
    </div>
  )
}

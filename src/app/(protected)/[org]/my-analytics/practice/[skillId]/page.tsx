import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Dumbbell } from 'lucide-react'

import { PracticeRunner } from '@/components/competency/practice-runner'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { prisma } from '@/lib/prisma'
import { getPracticeQuestions } from '@/services/competency/recommendations'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Practice — SelectIQ' }

/**
 * Plan 027 — practise one skill. Students only; only questions staff opened
 * for practice (getPracticeQuestions enforces it).
 */
export default async function PracticePage({ params }: { params: Promise<{ org: string; skillId: string }> }) {
  const { skillId } = await params
  const { org: slug } = await params
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user) notFound()
  if (user.role !== 'STUDENT') notFound()

  const skill = await prisma.skillNode.findFirst({
    where: { id: skillId, OR: [{ orgId: null }, { orgId: org.id }] },
    select: { name: true, section: { select: { name: true } } },
  })
  if (!skill) notFound()
  const questions = await getPracticeQuestions(user.id, org.id, skillId)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <Link href={`/${slug}/my-analytics/focus`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Focus areas
      </Link>
      <PageIntro icon={Dumbbell} title={`Practise ${skill.name}`} subtitle={skill.section.name} />
      {questions.length === 0 ? (
        <section className="siq-card siq-rise px-6 py-12 text-center">
          <p className="font-medium">No practice questions for {skill.name} yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
            Your college hasn’t opened any practice questions on this skill. Ask your placement cell — and revise the topic
            meanwhile.
          </p>
        </section>
      ) : (
        <PracticeRunner skillName={skill.name} questions={questions} backHref={`/${slug}/my-analytics/focus`} />
      )}
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Dumbbell } from 'lucide-react'

import { TrendLine } from '@/components/analytics/trend-line'
import { TIER_STYLE, TierBadge, TrendIndicator } from '@/components/competency/tier'
import { Bar, Ring } from '@/components/motion/animated'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { cn } from '@/lib/utils'
import { getStudentCompetencyView, getTopicHistory } from '@/services/competency/student-view'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Topic — Analytics — SelectIQ' }

/** Plan 027 — one topic in depth: every skill, the trend, and what to practise. Own data only. */
export default async function TopicPage({ params }: { params: Promise<{ org: string; sectionId: string }> }) {
  const { sectionId } = await params
  const { org: slug } = await params
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user) notFound()

  const [view, history] = await Promise.all([getStudentCompetencyView(user.id, org.id), getTopicHistory(user.id, org.id, sectionId)])
  const topic = view.topics.find((t) => t.id === sectionId)
  if (!topic) notFound()
  const focus = view.focus.filter((f) => f.topicId === sectionId)
  const t = TIER_STYLE[topic.tier]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Link href={`/${slug}/my-analytics`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Analytics
      </Link>

      <section className="siq-card siq-rise flex flex-wrap items-center gap-6 p-6">
        <Ring percent={topic.score} size={96} stroke={9} barClassName={t.ring}>
          <span className={cn('font-display text-2xl font-semibold', t.text)}>{topic.score}%</span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground font-mono text-xs font-semibold">{topic.code}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{topic.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <TierBadge tier={topic.tier} />
            <TrendIndicator trend={topic.trend} />
            <span className="text-muted-foreground text-xs">
              {topic.questions} graded question{topic.questions === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="siq-card siq-rise p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Skills</h2>
          <ul className="flex flex-col gap-4">
            {topic.skills.map((k) => (
              <li key={k.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-medium">{k.name}</span>
                  <TrendIndicator trend={k.trend} compact />
                  <TierBadge tier={k.tier} />
                  <span className={cn('siq-numeric w-10 text-right text-xs font-semibold', TIER_STYLE[k.tier].text)}>{k.score}%</span>
                </div>
                <Bar percent={k.score} barClassName={TIER_STYLE[k.tier].bar} className="h-1.5" />
                <p className="text-muted-foreground mt-1 text-[11px]">{k.questions} question{k.questions === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-col gap-5">
          <section className="siq-card siq-rise p-6">
            <h2 className="mb-4 text-[15px] font-semibold">Over time</h2>
            <TrendLine points={history} emptyText="Your trend appears after two tests on this topic." valueLabel="score" />
          </section>
          <section className="siq-card siq-rise p-6">
            <h2 className="mb-3 text-[15px] font-semibold">Practise next</h2>
            {focus.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing urgent in {topic.name}.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {focus.map((f) => (
                  <li key={f.skillId} className="flex items-center gap-3 rounded-xl border px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{f.skillName}</p>
                      <p className="text-muted-foreground truncate text-xs">{f.reason}</p>
                    </div>
                    {f.questionCount > 0 ? (
                      <Link href={`/${slug}/my-analytics/practice/${f.skillId}`} className="text-primary inline-flex items-center gap-1 text-xs font-semibold hover:underline">
                        <Dumbbell className="size-3.5" aria-hidden /> Practise
                      </Link>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">No practice set yet</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

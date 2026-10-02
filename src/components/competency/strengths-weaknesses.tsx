import Link from 'next/link'
import { ArrowRight, ChevronRight, Dumbbell, Sparkles, Target, Users } from 'lucide-react'

import { cohortPhrase, TIER_STYLE, TierBadge, TrendIndicator } from '@/components/competency/tier'
import { Bar } from '@/components/motion/animated'
import { cn } from '@/lib/utils'
import type { getStudentCompetencyView } from '@/services/competency/student-view'

type View = Awaited<ReturnType<typeof getStudentCompetencyView>>

/**
 * Plan 027 — the student's strengths & weaknesses, strength-first:
 * focus areas (with practice), what they're good at, then every topic.
 */

export function FocusAreas({ view, slug, limit = 3 }: { view: View; slug: string; limit?: number }) {
  const items = view.focus.slice(0, limit)
  return (
    <section className="siq-card siq-rise p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="bg-warning/15 text-warning grid size-8 place-items-center rounded-lg">
            <Target className="size-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold">Focus areas</h2>
            <p className="text-muted-foreground text-xs">What to work on first — biggest gains for your placements.</p>
          </div>
        </div>
        {view.focus.length > limit ? (
          <Link href={`/${slug}/my-analytics/focus`} className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline">
            All {view.focus.length} <ChevronRight className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground rounded-2xl border border-dashed px-4 py-6 text-center text-sm">
          Nothing urgent — every skill you’ve been tested on is on track. Keep it up.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((f, i) => (
            <li key={f.skillId} className="hover:bg-muted/40 flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors">
              <span className="bg-muted grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {f.skillName} <TierBadge tier={f.tier} />
                </p>
                <p className="text-muted-foreground truncate text-xs">{f.reason}</p>
              </div>
              {f.questionCount > 0 ? (
                <Link
                  href={`/${slug}/my-analytics/practice/${f.skillId}`}
                  className="bg-primary text-primary-foreground inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-transform hover:-translate-y-0.5"
                >
                  <Dumbbell className="size-3.5" aria-hidden /> Practise
                </Link>
              ) : (
                <Link href={`/${slug}/my-analytics/topics/${f.topicId}`} className="text-primary shrink-0 text-xs font-medium hover:underline">
                  See topic
                </Link>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

export function StrengthsCard({ view }: { view: View }) {
  if (view.strengths.length === 0) return null
  return (
    <section className="siq-card siq-rise p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="bg-success/12 text-success grid size-8 place-items-center rounded-lg">
          <Sparkles className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">Your strengths</h2>
          <p className="text-muted-foreground text-xs">Where you’re already doing well.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3">
        {view.strengths.map((s) => (
          <li key={s.id}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="min-w-0 truncate font-medium">
                {s.name}
                {s.topic ? <span className="text-muted-foreground font-normal"> · {s.topic}</span> : null}
              </span>
              <span className="text-success siq-numeric shrink-0 text-xs font-semibold">{s.score}%</span>
            </div>
            <Bar percent={s.score} barClassName="bg-success" className="h-1.5" />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TopicList({ view, slug, compare }: { view: View; slug: string; compare: boolean }) {
  return (
    <section className="siq-card siq-rise p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Topic by topic</h2>
          <p className="text-muted-foreground text-xs">Harder questions count more. Open a topic to see its skills.</p>
        </div>
        <Link
          href={`/${slug}/my-analytics${compare ? '' : '?compare=1'}`}
          scroll={false}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors',
            compare ? 'border-primary bg-primary/5 text-primary' : 'hover:bg-muted',
          )}
        >
          <Users className="size-3.5" aria-hidden />
          {compare ? 'Hide batch comparison' : 'Compare with my batch'}
        </Link>
      </div>
      <ul className="divide-y">
        {view.topics.map((t) => {
          const phrase = compare ? cohortPhrase(t.vs) : null
          return (
            <li key={t.id}>
              <Link href={`/${slug}/my-analytics/topics/${t.id}`} className="group hover:bg-muted/40 -mx-2 flex items-center gap-4 rounded-lg px-2 py-3 transition-colors">
                <span className="bg-muted grid h-8 min-w-12 place-items-center rounded-lg px-2 font-mono text-[11px] font-semibold">{t.code}</span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-sm">
                    <span className="truncate font-medium">{t.name}</span>
                    <TierBadge tier={t.tier} />
                    <TrendIndicator trend={t.trend} compact />
                  </div>
                  <Bar percent={t.score} barClassName={TIER_STYLE[t.tier].bar} className="h-1.5" />
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {t.skills.length} skill{t.skills.length === 1 ? '' : 's'} · {t.questions} question{t.questions === 1 ? '' : 's'}
                    {compare ? (
                      phrase ? (
                        <span className={cn('font-medium', phrase.cls)}> · {phrase.text}</span>
                      ) : (
                        <span> · not enough classmates yet to compare</span>
                      )
                    ) : null}
                  </p>
                </div>
                <span className={cn('siq-numeric w-12 shrink-0 text-right text-lg font-semibold', TIER_STYLE[t.tier].text)}>{t.score}%</span>
                <ArrowRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

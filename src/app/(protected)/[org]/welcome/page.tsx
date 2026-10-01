import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check } from 'lucide-react'

import { Ring } from '@/components/motion/animated'
import { ADMIN_CHAPTERS, HOD_CHAPTERS, STUDENT_CHAPTERS } from '@/components/story/chapters'
import { StoryPlayer } from '@/components/story/story-player'
import { FinishOnboarding } from '@/components/story/finish-onboarding'
import { ROLE_LABEL, labelOf } from '@/constants/labels'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getScope, listScopeDepartments } from '@/lib/auth/scope'
import { firstName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { managerChecklist, studentChecklist, type Step } from '@/services/onboarding'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Welcome — SelectIQ' }

/**
 * The welcome journey — first dashboard visit sends people here (and it
 * stays reachable from the dashboard's setup card). A role-specific story on
 * the left; on the right, a checklist that ticks itself off from real data.
 */
export default async function WelcomePage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  const org = await getOrgBySlug(slug)
  if (!org) notFound()

  const isStudent = user.role === 'STUDENT'
  const scope = isStudent ? null : await getScope(user, org.id)
  const [steps, depts] = await Promise.all([
    isStudent ? studentChecklist(user.id, org.id, slug) : managerChecklist(user, scope!, slug),
    scope && !scope.all ? listScopeDepartments(scope) : Promise.resolve([]),
  ])
  const chapters = isStudent ? STUDENT_CHAPTERS : user.role === 'COLLEGE_HOD' ? HOD_CHAPTERS : ADMIN_CHAPTERS
  const done = steps.filter((s) => s.done).length
  const pct = Math.round((done / steps.length) * 100)
  const name = firstName(user.name)
  const next = steps.find((s) => !s.done)

  const subtitle =
    user.role === 'COLLEGE_HOD'
      ? depts.length
        ? `You head ${depts.map((d) => d.code).join(', ')} at ${org.name}.`
        : `You're an HOD at ${org.name}. Your College Admin will assign your department.`
      : isStudent
        ? `You're all set up at ${org.name}. Here's how it works.`
        : `Let's get ${org.name} ready for its first placement test.`

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Story */}
      <div className="bg-primary siq-rise relative overflow-hidden rounded-3xl p-6 shadow-[var(--shadow-primary)] sm:p-8 lg:sticky lg:top-20 lg:self-start">
        <div className="siq-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="bg-highlight/20 pointer-events-none absolute -right-20 -bottom-20 size-72 rounded-full blur-3xl" aria-hidden />
        <StoryPlayer
          chapters={chapters}
          loop={false}
          className="relative"
          lastChapterCta={<FinishOnboarding href={`/${slug}/dashboard`} label="Take me to my dashboard" variant="highlight" />}
        />
      </div>

      {/* Journey */}
      <div className="flex flex-col gap-5">
        <div className="siq-rise" style={{ animationDelay: '80ms' }}>
          <span className="bg-highlight-tint text-highlight-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">
            {labelOf(ROLE_LABEL, user.role)}
          </span>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-tight">
            Welcome{name ? `, ${name}` : ''}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">{subtitle}</p>
        </div>

        <section className="siq-card siq-rise p-5 sm:p-6" style={{ animationDelay: '140ms' }}>
          <div className="flex items-center gap-4">
            <Ring percent={pct} size={64} stroke={7}>
              <span className="siq-numeric text-sm font-semibold">
                {done}/{steps.length}
              </span>
            </Ring>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{done === steps.length ? 'You’re all set' : 'Your first steps'}</p>
              <p className="text-muted-foreground text-sm">
                {done === steps.length ? 'Everything’s in place. Nice work.' : next ? `Up next: ${next.title.toLowerCase()}.` : ''}
              </p>
            </div>
          </div>

          <ol className="mt-5 flex flex-col">
            {steps.map((s, i) => (
              <StepRow key={s.key} step={s} index={i} last={i === steps.length - 1} isNext={s === next} />
            ))}
          </ol>
        </section>

        <div className="siq-rise flex flex-wrap items-center gap-3" style={{ animationDelay: '220ms' }}>
          <FinishOnboarding href={`/${slug}/dashboard`} label="Go to dashboard" />
          <p className="text-muted-foreground text-xs">You can come back to this page any time from your dashboard.</p>
        </div>
      </div>
    </div>
  )
}

function StepRow({ step: s, index, last, isNext }: { step: Step; index: number; last: boolean; isNext: boolean }) {
  return (
    <li className="siq-in-up relative flex gap-4 pb-5 last:pb-0" style={{ '--d': `${200 + index * 70}ms` } as React.CSSProperties}>
      {!last ? (
        <span className={cn('absolute top-9 bottom-0 left-[15px] w-0.5 rounded-full', s.done ? 'bg-primary/40' : 'bg-border')} aria-hidden />
      ) : null}
      <span
        className={cn(
          'relative grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors',
          s.done ? 'bg-primary text-primary-foreground' : isNext ? 'bg-highlight text-highlight-foreground ring-highlight/30 ring-4' : 'bg-muted text-muted-foreground',
        )}
      >
        {s.done ? <Check className="siq-in-scale size-4" aria-hidden /> : index + 1}
      </span>
      <div className={cn('min-w-0 flex-1 rounded-xl', isNext && 'bg-highlight-tint/60 -m-2 p-2')}>
        <p className={cn('text-sm font-semibold', s.done && 'text-muted-foreground line-through decoration-1')}>{s.title}</p>
        <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{s.body}</p>
        {!s.done ? (
          <Link href={s.href} className="text-primary group mt-1.5 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
            {s.cta}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </li>
  )
}

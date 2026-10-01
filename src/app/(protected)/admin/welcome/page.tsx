import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { Ring } from '@/components/motion/animated'
import { superAdminChapters } from '@/components/story/chapters'
import { FinishOnboarding } from '@/components/story/finish-onboarding'
import { StoryPlayer } from '@/components/story/story-player'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { firstName } from '@/lib/format'
import { prisma } from '@/lib/prisma'
import { cn } from '@/lib/utils'
import { platformChecklist } from '@/services/onboarding'

export const metadata: Metadata = { title: 'Welcome — Platform console — SelectIQ' }

/**
 * Super Admin welcome journey — the platform owner's story (one console,
 * onboarding, health, governance) and a checklist computed from the
 * platform itself.
 */
export default async function AdminWelcomePage() {
  const user = (await getCurrentUser())!
  const [steps, colleges] = await Promise.all([platformChecklist(), prisma.organization.count({ where: { type: 'COLLEGE' } })])
  const done = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)
  const name = firstName(user.name)

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="bg-primary siq-rise relative overflow-hidden rounded-3xl p-6 shadow-[var(--shadow-primary)] sm:p-8 lg:sticky lg:top-20 lg:self-start">
        <div className="siq-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="bg-highlight/20 pointer-events-none absolute -right-20 -bottom-20 size-72 rounded-full blur-3xl" aria-hidden />
        <StoryPlayer
          chapters={superAdminChapters({ colleges })}
          loop={false}
          className="relative"
          lastChapterCta={<FinishOnboarding href="/admin" label="Open the Platform console" variant="highlight" />}
        />
      </div>

      <div className="flex flex-col gap-5">
        <div className="siq-rise" style={{ animationDelay: '80ms' }}>
          <span className="bg-highlight-tint text-highlight-foreground inline-flex rounded-full px-2.5 py-1 text-xs font-semibold">Super Admin</span>
          <h1 className="mt-3 text-[30px] leading-tight font-semibold tracking-tight">Welcome{name ? `, ${name}` : ''}</h1>
          <p className="text-muted-foreground mt-1.5 text-[15px]">You run SelectIQ — every college, every person. Here&apos;s how the platform works.</p>
        </div>

        <section className="siq-card siq-rise p-5 sm:p-6" style={{ animationDelay: '140ms' }}>
          <div className="flex items-center gap-4">
            <Ring percent={(done / steps.length) * 100} size={64} stroke={7}>
              <span className="siq-numeric text-sm font-semibold">
                {done}/{steps.length}
              </span>
            </Ring>
            <div>
              <p className="font-semibold">{done === steps.length ? 'The platform is in good shape' : 'Platform setup'}</p>
              <p className="text-muted-foreground text-sm">{next ? `Up next: ${next.title.toLowerCase()}.` : 'Everything’s in place.'}</p>
            </div>
          </div>
          <ol className="mt-5 flex flex-col">
            {steps.map((s, i) => (
              <li key={s.key} className="siq-in-up relative flex gap-4 pb-5 last:pb-0" style={{ '--d': `${200 + i * 70}ms` } as React.CSSProperties}>
                {i < steps.length - 1 ? <span className={cn('absolute top-9 bottom-0 left-[15px] w-0.5 rounded-full', s.done ? 'bg-primary/40' : 'bg-border')} aria-hidden /> : null}
                <span
                  className={cn(
                    'relative grid size-8 shrink-0 place-items-center rounded-full text-xs font-semibold',
                    s.done ? 'bg-primary text-primary-foreground' : s === next ? 'bg-highlight text-highlight-foreground ring-highlight/30 ring-4' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {s.done ? <Check className="size-4" aria-hidden /> : i + 1}
                </span>
                <div className={cn('min-w-0 flex-1 rounded-xl', s === next && 'bg-highlight-tint/60 -m-2 p-2')}>
                  <p className={cn('text-sm font-semibold', s.done && 'text-muted-foreground line-through decoration-1')}>{s.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-sm leading-snug">{s.body}</p>
                  {!s.done ? (
                    <Link href={s.href} className="text-primary group mt-1.5 inline-flex items-center gap-1 text-sm font-semibold hover:underline">
                      {s.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="siq-rise flex flex-wrap items-center gap-3" style={{ animationDelay: '220ms' }}>
          <FinishOnboarding href="/admin" label="Go to the Platform console" />
          <p className="text-muted-foreground text-xs">This page stays at /admin/welcome.</p>
        </div>
      </div>
    </div>
  )
}

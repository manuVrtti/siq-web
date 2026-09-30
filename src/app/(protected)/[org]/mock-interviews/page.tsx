import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BrainCircuit, Code2, MessagesSquare, Mic, Sparkles, Target } from 'lucide-react'

import { PageIntro } from '@/components/student/page-intro'

export const metadata: Metadata = { title: 'Mock interviews — SelectIQ' }

const TRACKS = [
  { icon: Code2, title: 'Technical', body: 'DSA, OOP, DBMS, OS and CN — the rounds service and product companies ask.' },
  { icon: MessagesSquare, title: 'HR & behavioural', body: '“Tell me about yourself”, strengths, projects, and why this company.' },
  { icon: BrainCircuit, title: 'Role-based', body: 'Practice for SDE, data analyst, QA and support roles.' },
]

const FEEDBACK = [
  { label: 'Technical accuracy', value: 78 },
  { label: 'Clarity of explanation', value: 64 },
  { label: 'Confidence & pace', value: 71 },
]

/**
 * Mock interviews — not built yet. The tab exists so students know it's
 * coming; the page says so plainly and has no buttons that pretend to work.
 */
export default async function MockInterviewsPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageIntro
        icon={MessagesSquare}
        title="Mock interviews"
        subtitle="Practise interviews before the real one."
        aside={
          <span className="bg-accent text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
            <Sparkles className="size-3.5" aria-hidden /> Coming soon
          </span>
        }
      />

      <section className="bg-primary text-primary-foreground siq-rise relative overflow-hidden rounded-3xl p-6 shadow-[var(--shadow-primary)] sm:p-10">
        <div className="siq-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="text-sm font-medium text-white/75">In the works</p>
            <h2 className="mt-2 text-[26px] leading-tight font-semibold tracking-tight sm:text-3xl">
              Talk through real interview questions and get feedback on every answer.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80">
              Pick a track, answer out loud or in text, and see what you did well and what to tighten up — before
              you sit in front of a panel.
            </p>
          </div>

          {/* Sample of the feedback card — illustrative, not your data. */}
          <div aria-hidden className="rounded-2xl bg-white p-5 text-foreground shadow-2xl shadow-black/25">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-lg bg-highlight-tint text-primary">
                <Mic className="size-4" />
              </span>
              <div>
                <p className="text-sm font-semibold">Explain a hash map</p>
                <p className="text-[11px] text-muted-foreground">Technical · Question 3 of 8 · sample</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {FEEDBACK.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{f.label}</span>
                    <span className="font-semibold tabular-nums">{f.value}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="siq-grow h-full rounded-full bg-primary" style={{ width: `${f.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              <b className="text-foreground">Tip:</b> mention collision handling and the average vs worst-case lookup time.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {TRACKS.map((t, i) => (
          <div key={t.title} className="siq-card siq-rise p-5" style={{ animationDelay: `${100 + i * 60}ms` }}>
            <span className="bg-accent text-primary grid size-10 place-items-center rounded-xl">
              <t.icon className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-sm font-semibold">{t.title}</p>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">{t.body}</p>
          </div>
        ))}
      </div>

      <section className="siq-card siq-rise flex flex-col gap-4 p-5 sm:flex-row sm:items-center" style={{ animationDelay: '300ms' }}>
        <span className="bg-accent text-primary grid size-10 shrink-0 place-items-center rounded-xl">
          <Target className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold">Until then, sharpen your weak topics</p>
          <p className="text-muted-foreground text-sm">Your Analytics tab shows exactly which topics to practise next.</p>
        </div>
        <Link
          href={`/${slug}/my-analytics`}
          className="text-primary group inline-flex items-center gap-1 text-sm font-semibold hover:underline"
        >
          Open analytics
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </section>
    </div>
  )
}

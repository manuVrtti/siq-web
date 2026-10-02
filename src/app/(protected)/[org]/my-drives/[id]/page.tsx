import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Clock, Lock, Play, Trophy, X } from 'lucide-react'

import { EmployerMark, fmtDate } from '@/components/mock-drives/bits'
import { StudentDriveButtons } from '@/components/mock-drives/drive-controls'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { cn } from '@/lib/utils'
import { getStudentDriveJourney, type RoundState } from '@/services/mock-drive-student'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Mock drive — SelectIQ' }

const STATE: Record<RoundState, { label: string; icon: typeof Check; dot: string; text: string }> = {
  CLEARED: { label: 'Cleared', icon: Check, dot: 'bg-success text-white', text: 'text-success' },
  NOT_SHORTLISTED: { label: 'Not shortlisted', icon: X, dot: 'bg-destructive text-white', text: 'text-destructive' },
  TAKE_NOW: { label: 'Open now — take it', icon: Play, dot: 'bg-primary text-primary-foreground animate-pulse', text: 'text-primary' },
  AWAITING_RESULT: { label: 'Submitted — result coming', icon: Clock, dot: 'bg-warning text-white', text: 'text-warning' },
  UPCOMING: { label: 'Up next', icon: Clock, dot: 'bg-muted text-muted-foreground', text: 'text-muted-foreground' },
  LOCKED: { label: 'Locked', icon: Lock, dot: 'bg-muted text-muted-foreground', text: 'text-muted-foreground' },
}

/** Plan 024 — one drive, round by round, for the signed-in student. */
export default async function DriveJourneyPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user || user.role !== 'STUDENT') notFound()
  const j = await getStudentDriveJourney(user.id, org.id, id).catch(() => null)
  if (!j) notFound()
  const d = j.drive

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <Link href={`/${slug}/my-drives`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Mock drives
      </Link>

      <section className="siq-card siq-rise flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
        <EmployerMark name={d.employerName} logo={d.employerLogo} className="size-14" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{d.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {d.employerName} · {d.roleTitle}
            {d.roleCtc ? ` · ${d.roleCtc}` : ''} · <span className="italic">practice drive</span>
          </p>
          {d.description ? <p className="mt-3 text-sm whitespace-pre-wrap">{d.description}</p> : null}
          <p className="text-muted-foreground mt-3 text-xs">
            {d.departments.length ? d.departments.join(', ') : 'All departments'} · {d.batchYears.length ? `Batch ${d.batchYears.join(', ')}` : 'Any batch'}
            {d.minCgpa !== null ? ` · CGPA ${d.minCgpa}+` : ''}
            {d.registrationDeadline ? ` · register by ${fmtDate(d.registrationDeadline)}` : ''}
          </p>
          <div className="mt-4">
            {!j.registered && j.reasons.length ? (
              <p className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-sm">{j.reasons.join(' · ')}</p>
            ) : (
              <StudentDriveButtons driveId={d.id} registered={j.registered} canRegister={j.canRegister} canWithdraw={j.canWithdraw} />
            )}
          </div>
        </div>
      </section>

      {j.finalist ? (
        <section className="siq-rise from-success/15 to-highlight/15 flex items-center gap-3 rounded-2xl bg-gradient-to-r px-5 py-4">
          <Trophy className="text-highlight size-8 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">You made the final shortlist!</p>
            <p className="text-muted-foreground text-sm">You cleared every round. Now do it for real.</p>
          </div>
        </section>
      ) : j.eliminated ? (
        <section className="siq-rise flex items-center gap-3 rounded-2xl border px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">This drive ended for you — and that’s what practice is for.</p>
            <p className="text-muted-foreground text-sm">See exactly which topics to work on before the next one.</p>
          </div>
          <Link href={`/${slug}/my-analytics`} className="text-primary inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
            Your focus areas <ArrowRight className="size-4" aria-hidden />
          </Link>
        </section>
      ) : null}

      <section className="siq-card siq-rise p-6">
        <h2 className="mb-5 text-[15px] font-semibold">Rounds</h2>
        <ol className="relative flex flex-col gap-6 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-current/15">
          {j.rounds.map((r) => {
            const s = STATE[r.state]
            return (
              <li key={r.id} className="relative flex gap-4">
                <span className={cn('relative z-10 grid size-8 shrink-0 place-items-center rounded-full', s.dot)}>
                  <s.icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{r.name}</p>
                    {r.score !== null ? <span className={cn('siq-numeric text-sm font-semibold', s.text)}>{Math.round(r.score)}%</span> : null}
                  </div>
                  <p className={cn('text-xs font-medium', s.text)}>{s.label}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {r.test} · {r.durationMinutes} min{r.cutoff !== null ? ` · clear with ${r.cutoff}%` : ''}
                    {r.scheduledAt ? ` · ${fmtDate(r.scheduledAt)}` : ''}
                  </p>
                  {r.note ? <p className="text-muted-foreground mt-1 text-xs italic">{r.note}</p> : null}
                  {r.token ? (
                    <Link href={`/exam/${r.token}`} className="bg-primary text-primary-foreground mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-transform hover:-translate-y-0.5">
                      <Play className="size-4" aria-hidden /> Take this round
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}

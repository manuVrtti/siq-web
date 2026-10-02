import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Rocket, Trophy } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { EmployerMark, fmtDate } from '@/components/mock-drives/bits'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { listStudentDrives } from '@/services/mock-drive-student'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'Mock drives — SelectIQ' }

/** Plan 024 — the student's mock drives and the open ones they can join. Own data only. */
export default async function MyDrivesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const [user, org] = await Promise.all([getCurrentUser(), getOrgBySlug(slug)])
  if (!org || !user || user.role !== 'STUDENT') notFound()
  const { mine, open } = await listStudentDrives(user.id, org.id)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageIntro icon={Rocket} title="Mock drives" subtitle="Practice placement drives — real rounds, real cutoffs, no real stakes." />

      {mine.length === 0 && open.length === 0 ? (
        <section className="siq-card siq-rise px-6 py-14 text-center">
          <p className="font-medium">No mock drives yet</p>
          <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">When your placement cell opens one you can join, it will appear here — and in your notifications.</p>
        </section>
      ) : null}

      {mine.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Your drives</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {mine.map((d) => (
              <Link key={d.id} href={`/${slug}/my-drives/${d.id}`} className="siq-card siq-lift siq-rise group flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <EmployerMark name={d.employerName} logo={d.employerLogo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="text-muted-foreground truncate text-sm">{d.employerName} · {d.roleTitle}</p>
                  </div>
                  {d.finalist ? (
                    <Pill tone="success">
                      <Trophy className="mr-1 size-3" aria-hidden /> Shortlisted
                    </Pill>
                  ) : d.eliminated ? (
                    <Pill tone="muted">Ended</Pill>
                  ) : d.actionNeeded ? (
                    <Pill tone="warning">Round open</Pill>
                  ) : (
                    <Pill tone="info">{d.status === 'COMPLETED' ? 'Finished' : 'In'}</Pill>
                  )}
                </div>
                <div className="flex gap-1" aria-label={`${d.cleared} of ${d.rounds} rounds cleared`}>
                  {Array.from({ length: d.rounds }, (_, i) => (
                    <span key={i} className={i < d.cleared ? 'bg-success h-1.5 flex-1 rounded-full' : d.eliminated && i === d.cleared ? 'bg-destructive/60 h-1.5 flex-1 rounded-full' : 'bg-muted h-1.5 flex-1 rounded-full'} />
                  ))}
                </div>
                <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
                  {d.actionNeeded ? 'Take your round' : 'See your journey'} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {open.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">Open for registration</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {open.map((d) => (
              <Link key={d.id} href={`/${slug}/my-drives/${d.id}`} className="siq-card siq-lift siq-rise group flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <EmployerMark name={d.employerName} logo={d.employerLogo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {d.employerName} · {d.roleTitle}
                      {d.roleCtc ? ` · ${d.roleCtc}` : ''}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  {d.rounds} round{d.rounds === 1 ? '' : 's'}
                  {d.registrationDeadline ? ` · register by ${fmtDate(d.registrationDeadline)}` : ''}
                </p>
                {d.reasons.length ? (
                  <p className="text-warning text-xs">{d.reasons.join(' · ')}</p>
                ) : (
                  <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
                    View &amp; register <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

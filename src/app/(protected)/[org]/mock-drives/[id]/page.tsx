import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Activity, AlertTriangle, Pencil } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { DRIVE_STATUS, EmployerMark, fmtDate } from '@/components/mock-drives/bits'
import { EnrolButton, LifecycleButtons, RoundsEditor } from '@/components/mock-drives/drive-controls'
import { Button } from '@/components/ui/button'
import { requireDrivePage } from '@/lib/auth/drive-page'
import { assessmentWhere } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { getEligibleStudents } from '@/services/mock-drive-registration'
import { canManageDrive, driveBlockers, getDrive } from '@/services/mock-drives'

export const metadata: Metadata = { title: 'Mock drive — SelectIQ' }

/** Plan 023 — set up one drive: status, checklist, who can enter, rounds, enrolment. */
export default async function DrivePage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params
  const { scope } = await requireDrivePage(slug)
  const drive = await getDrive(scope, id).catch(() => null)
  if (!drive) notFound()
  const canManage = canManageDrive(scope, drive)
  const started = ['IN_PROGRESS', 'COMPLETED', 'ARCHIVED'].includes(drive.status)
  const [tests, eligible] = await Promise.all([
    canManage && !started
      ? prisma.assessment.findMany({ where: { ...assessmentWhere(scope), status: { not: 'ARCHIVED' } }, orderBy: { updatedAt: 'desc' }, select: { id: true, title: true, status: true } })
      : Promise.resolve([]),
    canManage && !started ? getEligibleStudents(scope, id) : Promise.resolve([]),
  ])
  const blockers = driveBlockers(drive)
  const st = DRIVE_STATUS[drive.status]!

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <Link href={`/${slug}/mock-drives`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> Mock drives
      </Link>

      <section className="siq-card siq-rise flex flex-col gap-4 p-6 md:flex-row md:items-start">
        <EmployerMark name={drive.employerName} logo={drive.employerLogo} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{drive.title}</h1>
            <Pill tone={st.tone}>{st.label}</Pill>
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {drive.employerName}
            {drive.mode === 'SAMPLE_COMPANY' ? ' (sample company)' : ' (simulated)'} · {drive.roleTitle}
            {drive.roleCtc ? ` · ${drive.roleCtc}` : ''}
          </p>
          {drive.description ? <p className="mt-3 text-sm whitespace-pre-wrap">{drive.description}</p> : null}
        </div>
        <LifecycleButtons driveId={drive.id} status={drive.status} canManage={canManage} slug={slug} />
      </section>

      {blockers.length && !started ? (
        <section className="bg-warning/10 siq-rise flex gap-3 rounded-xl px-4 py-3 text-sm">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Before students can register</p>
            <ul className="text-muted-foreground mt-1 list-disc pl-4">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="siq-card siq-rise flex flex-col gap-3 p-6">
          <h2 className="text-[15px] font-semibold">Rounds</h2>
          <RoundsEditor
            driveId={drive.id}
            editable={canManage && !started}
            canProctor={canManage && !['COMPLETED', 'ARCHIVED'].includes(drive.status)}
            tests={tests}
            rounds={drive.rounds.map((r) => ({
              id: r.id,
              order: r.order,
              name: r.name,
              testTitle: r.assessment.title,
              testStatus: r.assessment.status,
              cutoff: r.cutoffScore,
              activated: Boolean(r.activatedAt),
              evaluated: Boolean(r.evaluatedAt),
              proctored: r.assessment.proctoringEnabled,
            }))}
          />
        </section>

        <div className="flex flex-col gap-5">
          <section className="siq-card siq-rise flex flex-col gap-3 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Who can enter</h2>
              {canManage && !['COMPLETED', 'ARCHIVED'].includes(drive.status) ? (
                <Link href={`/${slug}/mock-drives/${drive.id}/edit`} className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
                  <Pencil className="size-3" aria-hidden /> Edit drive
                </Link>
              ) : null}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Departments</dt>
              <dd>{drive.targets.length ? drive.targets.map((t) => t.department.code).join(', ') : 'Whole college'}</dd>
              <dt className="text-muted-foreground">Batches</dt>
              <dd>{drive.batchYears.length ? drive.batchYears.join(', ') : 'Any'}</dd>
              <dt className="text-muted-foreground">Min CGPA</dt>
              <dd>{drive.minCgpa ?? 'None'}</dd>
              <dt className="text-muted-foreground">Registration closes</dt>
              <dd>{fmtDate(drive.registrationDeadline) ?? '—'}</dd>
              <dt className="text-muted-foreground">Dates</dt>
              <dd>{drive.startDate ? `${fmtDate(drive.startDate)}${drive.endDate ? ` → ${fmtDate(drive.endDate)}` : ''}` : '—'}</dd>
            </dl>
          </section>

          <section className="siq-card siq-rise flex flex-col gap-3 p-6">
            <h2 className="text-[15px] font-semibold">Students</h2>
            <p className="text-sm">
              <b className="font-display text-2xl">{drive._count.registrations}</b> registered
              {!started && canManage ? <span className="text-muted-foreground"> · {eligible.length} more eligible</span> : null}
            </p>
            {!started && canManage ? <EnrolButton driveId={drive.id} eligible={eligible.length} /> : null}
            <p className="text-muted-foreground text-xs">
              Eligible students can also register themselves while registration is open (Mock drives in their sidebar).
            </p>
            <Button variant="outline" size="sm" className="self-start" render={<Link href={`/${slug}/mock-drives/${drive.id}/monitor`} />}>
              <Activity className="size-3.5" aria-hidden /> Live monitor
            </Button>
          </section>
        </div>
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Trophy } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { DRIVE_STATUS } from '@/components/mock-drives/bits'
import { CompleteButton, OverrideButton, RoundRunButtons } from '@/components/mock-drives/drive-controls'
import { Bar } from '@/components/motion/animated'
import { requireDrivePage } from '@/lib/auth/drive-page'
import { cn } from '@/lib/utils'
import { listRegistrations } from '@/services/mock-drive-registration'
import { getDriveStandings } from '@/services/mock-drive-runtime'
import { canManageDrive, getDrive } from '@/services/mock-drives'

export const metadata: Metadata = { title: 'Live monitor — Mock drive — SelectIQ' }

/** Plan 024 — run the drive: funnel, round controls, every student's progress, overrides. */
export default async function MonitorPage({ params }: { params: Promise<{ org: string; id: string }> }) {
  const { org: slug, id } = await params
  const { scope } = await requireDrivePage(slug)
  const drive = await getDrive(scope, id).catch(() => null)
  if (!drive) notFound()
  const [standings, regs] = await Promise.all([getDriveStandings(scope, id), listRegistrations(scope, id)])
  const canRun = canManageDrive(scope, drive) && drive.status === 'IN_PROGRESS'
  const st = DRIVE_STATUS[drive.status]!
  const max = Math.max(1, standings.registrations)
  const allClosed = drive.rounds.length > 0 && drive.rounds.every((r) => r.evaluatedAt)

  const funnel = [
    { label: 'Registered', n: standings.registrations },
    ...standings.rounds.map((r) => ({ label: `Cleared ${r.name}`, n: r.shortlisted, pending: r.pending })),
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <Link href={`/${slug}/mock-drives/${id}`} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="size-3.5" aria-hidden /> {drive.title}
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Live monitor</h1>
          <Pill tone={st.tone}>{st.label}</Pill>
        </div>
        {canRun ? <CompleteButton driveId={id} ready={allClosed} /> : null}
      </div>
      {drive.status !== 'IN_PROGRESS' && drive.status !== 'COMPLETED' ? (
        <p className="bg-muted text-muted-foreground rounded-xl px-4 py-3 text-sm">Rounds can be opened once the drive is started (on the drive page).</p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <section className="siq-card siq-rise p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Funnel</h2>
          <ol className="flex flex-col gap-3">
            {funnel.map((f) => (
              <li key={f.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{f.label}</span>
                  <span className="siq-numeric font-semibold">
                    {f.n}
                    {'pending' in f && f.pending ? <span className="text-muted-foreground font-normal"> · {f.pending} pending</span> : null}
                  </span>
                </div>
                <Bar percent={(f.n / max) * 100} className="h-2" />
              </li>
            ))}
            <li className="flex items-center gap-2 pt-1 text-sm font-medium">
              <Trophy className="text-highlight size-4" aria-hidden /> Final shortlist: {standings.finalists}
            </li>
          </ol>
        </section>

        <section className="siq-card siq-rise p-6">
          <h2 className="mb-4 text-[15px] font-semibold">Rounds</h2>
          <ol className="flex flex-col gap-3">
            {standings.rounds.map((r, i) => {
              const prevClosed = i === 0 || standings.rounds[i - 1]!.evaluated
              const testReady = drive.rounds.find((x) => x.id === r.id)?.assessment.status === 'PUBLISHED'
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3">
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold', r.evaluated ? 'bg-success/15 text-success' : r.activated ? 'bg-warning/15 text-warning' : 'bg-muted')}>{r.order}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {r.cutoff === null ? 'No cutoff' : `Cutoff ${r.cutoff}%`} ·{' '}
                      {r.evaluated ? `closed — ${r.shortlisted} through, ${r.eliminated} out` : r.activated ? `open — ${r.taking - r.pending} done, ${r.pending} to go` : 'not open yet'}
                    </p>
                  </div>
                  <RoundRunButtons driveId={id} canRun={canRun} round={{ id: r.id, name: r.name, activated: r.activated, evaluated: r.evaluated, ready: prevClosed && testReady }} />
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <section className="siq-card siq-rise overflow-hidden">
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold">Students</h2>
          <p className="text-muted-foreground text-xs">Score and outcome per round. Reinstate or remove a student until the next round opens; the reason is logged.</p>
        </div>
        {regs.length === 0 ? (
          <p className="text-muted-foreground border-t px-6 py-8 text-center text-sm">No one is registered yet.</p>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
                <tr>
                  <th className="px-6 py-2.5 font-medium">Student</th>
                  {drive.rounds.map((r) => (
                    <th key={r.id} className="px-3 py-2.5 font-medium">
                      R{r.order}
                    </th>
                  ))}
                  <th className="px-6 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {regs.map((g) => {
                  const name = g.user.name ?? g.user.email ?? 'Student'
                  const finalist = !g.eliminated && g.currentRound === drive.rounds.length && drive.rounds.length > 0
                  return (
                    <tr key={g.id}>
                      <td className="px-6 py-2.5">
                        <p className="font-medium">{name}</p>
                        <p className="text-muted-foreground text-xs">{g.user.memberships[0]?.department?.code ?? '—'}</p>
                      </td>
                      {drive.rounds.map((r, i) => {
                        const rr = g.roundResults.find((x) => x.roundId === r.id)
                        const next = drive.rounds[i + 1]
                        const canOverride = canRun && rr && rr.outcome !== 'PENDING' && !next?.activatedAt
                        const id = (rr as { id?: string } | undefined)?.id
                        return (
                          <td key={r.id} className="px-3 py-2.5">
                            {!rr ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-col">
                                <span className={cn('text-xs font-semibold', rr.outcome === 'SHORTLISTED' ? 'text-success' : rr.outcome === 'ELIMINATED' ? 'text-destructive' : 'text-muted-foreground')}>
                                  {rr.score !== null ? `${Math.round(rr.score)}%` : rr.outcome === 'PENDING' ? 'pending' : '—'}
                                  {rr.outcome === 'SHORTLISTED' ? ' ✓' : rr.outcome === 'ELIMINATED' ? ' ✗' : ''}
                                </span>
                                {rr.overrideReason ? <span className="text-muted-foreground max-w-40 truncate text-[11px]" title={rr.overrideReason}>{rr.overrideReason}</span> : null}
                                {canOverride && id ? <OverrideButton roundResultId={id} outcome={rr.outcome as 'SHORTLISTED' | 'ELIMINATED'} studentName={name} /> : null}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="px-6 py-2.5">
                        {g.eliminated ? <Pill tone="danger">Out</Pill> : finalist ? <Pill tone="success">{drive.status === 'COMPLETED' ? 'Final shortlist' : 'Cleared all'}</Pill> : <Pill tone="info">In</Pill>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

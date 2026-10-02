import { CheckCircle2, Eye, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { FLAG_GROUPS, FLAG_LABEL, RISK_STYLE, assessRisk } from '@/lib/proctoring/integrity'
import { cn } from '@/lib/utils'
import type { getSessionForAdmin } from '@/services/proctoring'

/**
 * Plan 018b — staff-only exam integrity review for one attempt: risk,
 * identity (ID photo vs pre-exam photo), random checks, activity counts and
 * a timeline. Rendered on the grade page (College Admin / the student's
 * HOD). Never part of any student page.
 */

type Session = NonNullable<Awaited<ReturnType<typeof getSessionForAdmin>>>

const time = (d: Date | string) =>
  new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date(d))
const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `${Math.round(n * 100)}%`)

function Photo({ url, label, sub }: { url: string | null; label: string; sub?: string }) {
  return (
    <figure className="flex flex-col gap-1.5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
        <img src={url} alt={label} className="aspect-[4/3] w-44 rounded-lg border bg-black object-cover" />
      ) : (
        <div className="bg-muted text-muted-foreground grid aspect-[4/3] w-44 place-items-center rounded-lg text-xs">No photo</div>
      )}
      <figcaption className="text-xs">
        <span className="font-medium">{label}</span>
        {sub ? <span className="text-muted-foreground block">{sub}</span> : null}
      </figcaption>
    </figure>
  )
}

export function ExamIntegrityPanel({ session }: { session: Session | null }) {
  if (!session) {
    return (
      <section className="siq-card p-5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold">
          <Eye className="size-4" aria-hidden /> Exam integrity
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">No activity log for this attempt — it was taken before activity tracking began.</p>
      </section>
    )
  }

  const id = session.identity
  const failedChecks = session.checks.filter((c) => !c.matched).length
  const risk = assessRisk({ flags: session.flags, identityOutcome: id?.outcome, checksFailed: failedChecks })
  const rs = RISK_STYLE[risk]
  const count = (types: string[]) => session.flags.filter((f) => types.includes(f.type)).length
  const groups = FLAG_GROUPS.map((g) => ({ ...g, n: count(g.types) })).filter((g) => g.n > 0)

  return (
    <section className="siq-card siq-rise flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-semibold">
            {risk === 'CLEAR' ? <ShieldCheck className="text-success size-4" aria-hidden /> : <ShieldAlert className={cn('size-4', risk === 'HIGH' ? 'text-destructive' : 'text-warning')} aria-hidden />}
            Exam integrity
          </h2>
          <p className="text-muted-foreground text-xs">Only staff can see this. Times are IST.</p>
        </div>
        <Pill tone={rs.tone}>{rs.label}</Pill>
      </div>

      {/* Identity */}
      {id || session.referenceSignedUrl ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Identity</h3>
          <div className="flex flex-wrap items-start gap-4">
            {id ? <Photo url={id.idUrl} label="ID photo" sub={id.idSource === 'SELFIE' ? 'First verified exam selfie' : id.idSource === 'COLLEGE_UPLOAD' ? 'Uploaded by the college' : id.idSource === 'STUDENT_UPLOAD' ? 'Uploaded by the student' : undefined} /> : null}
            {id ? <Photo url={id.liveUrl} label="Before the exam" sub={time(id.at)} /> : null}
            {session.referenceSignedUrl ? <Photo url={session.referenceSignedUrl} label="At exam start" sub={time(session.createdAt)} /> : null}
            {id ? (
              <div className="flex min-w-48 flex-col gap-1 text-sm">
                {id.outcome === 'MISMATCH' ? (
                  <span className="text-destructive inline-flex items-center gap-1.5 font-semibold">
                    <XCircle className="size-4" aria-hidden /> Not confirmed
                  </span>
                ) : (
                  <span className="text-success inline-flex items-center gap-1.5 font-semibold">
                    <CheckCircle2 className="size-4" aria-hidden /> {id.outcome === 'ENROLLED' ? 'ID photo created' : 'Matched'}
                  </span>
                )}
                <span className="text-muted-foreground">
                  Match {pct(id.matchScore)} · {id.attempts} {id.attempts === 1 ? 'try' : 'tries'}
                </span>
                <span className="text-muted-foreground text-xs">Compare the photos yourself — face matching is a guide, not proof.</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Random checks */}
      {session.checks.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">
            Random checks during the exam <span className="text-muted-foreground font-normal">· {session.checks.length}</span>
          </h3>
          <ul className="flex flex-wrap gap-3">
            {session.checks.map((c) => (
              <li key={c.id} className="flex w-32 flex-col gap-1">
                {c.snapshotSignedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- signed URL
                  <img src={c.snapshotSignedUrl} alt="Random check" className={cn('aspect-[4/3] w-32 rounded-md border-2 object-cover', c.matched ? 'border-success/50' : 'border-destructive')} />
                ) : (
                  <div className="bg-muted aspect-[4/3] w-32 rounded-md" />
                )}
                <span className={cn('text-[11px] font-medium', c.matched ? 'text-success' : 'text-destructive')}>
                  {c.faceCount === 0 ? 'No face' : c.faceCount > 1 ? `${c.faceCount} faces` : c.matched ? `Match ${pct(c.matchScore)}` : `Different · ${pct(c.matchScore)}`}
                </span>
                <span className="text-muted-foreground text-[11px]">{time(c.occurredAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Activity counts */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Activity</h3>
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing unusual recorded.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {groups.map((g) => (
              <li key={g.label} className="rounded-lg border px-3 py-2">
                <p className="font-display text-xl font-semibold">{g.n}</p>
                <p className="text-muted-foreground text-xs">{g.label}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Timeline */}
      {session.flags.length ? (
        <details className="group">
          <summary className="text-primary cursor-pointer text-sm font-medium">Timeline ({session.flags.length})</summary>
          <ol className="mt-3 flex flex-col divide-y rounded-lg border">
            {session.flags.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="text-muted-foreground siq-numeric w-20 shrink-0 text-xs">{time(f.occurredAt)}</span>
                <span className={cn('size-2 shrink-0 rounded-full', f.severity === 'HIGH' ? 'bg-destructive' : f.severity === 'MEDIUM' ? 'bg-warning' : 'bg-muted-foreground/40')} />
                <span className="min-w-0 flex-1">
                  {FLAG_LABEL[f.type] ?? f.type}
                  {f.type === 'FOCUS_LOSS' && typeof (f.metadata as { durationMs?: number } | null)?.durationMs === 'number' ? (
                    <span className="text-muted-foreground"> · {Math.round((f.metadata as { durationMs: number }).durationMs / 1000)}s</span>
                  ) : null}
                  {typeof (f.metadata as { app?: string } | null)?.app === 'string' ? (
                    <span className="font-medium"> · {(f.metadata as { app: string }).app}</span>
                  ) : null}
                  {typeof (f.metadata as { shortcut?: string } | null)?.shortcut === 'string' ? (
                    <span className="text-muted-foreground"> · {(f.metadata as { shortcut: string }).shortcut}</span>
                  ) : null}
                  {(f.metadata as { from?: string } | null)?.from === 'exam-browser' ? <span className="text-muted-foreground"> · reported by exam browser</span> : null}
                </span>
                {f.snapshotSignedUrl ? (
                  <a href={f.snapshotSignedUrl} target="_blank" rel="noopener noreferrer" className="text-primary text-xs hover:underline">
                    Photo
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </section>
  )
}

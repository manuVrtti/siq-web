import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Briefcase, ExternalLink, FileText, FolderGit2, GraduationCap, Trophy } from 'lucide-react'

import { Panel } from '@/components/analytics/panel'
import { StatCard } from '@/components/analytics/stat-card'
import { Initials, Pill, StatusPill } from '@/components/dashboard/bits'
import { ListHeader } from '@/components/data/list-header'
import { Button } from '@/components/ui/button'
import { PERMISSIONS } from '@/constants/permissions'
import { requirePageScope } from '@/lib/auth/page-guard'
import { NotFoundError } from '@/lib/errors'
import { timeAgo } from '@/lib/format'
import { computeCompleteness, getCandidateForManager } from '@/services/profile'

export const metadata: Metadata = { title: 'Candidate — SelectIQ' }

const monthYear = (d: Date | null) =>
  d ? new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(d) : null

/**
 * A candidate as their placement cell sees them (ABtalks admin candidate
 * detail): profile, academics, projects, experience, this college's exam
 * history, batches. Read-only — the profile belongs to the student.
 */
export default async function CandidateDetailPage({
  params,
}: {
  params: Promise<{ org: string; id: string }>
}) {
  const { org: slug, id } = await params
  const { org, scope } = await requirePageScope(PERMISSIONS.MANAGE_ORG_USERS, slug)

  let c
  try {
    c = await getCandidateForManager(scope, id)
  } catch (e) {
    if (e instanceof NotFoundError) notFound()
    throw e
  }
  const p = c.profile
  const { percent } = computeCompleteness(c)
  const graded = c.results.filter((r) => r.status === 'GRADED')
  const avg = graded.length ? Math.round((graded.reduce((n, r) => n + r.percentage, 0) / graded.length) * 10) / 10 : null
  const links = [
    { label: 'LinkedIn', href: p?.linkedinUrl },
    { label: 'GitHub', href: p?.githubUrl },
    { label: 'Portfolio', href: p?.portfolioUrl },
    { label: 'Coding profile', href: p?.codingUrl },
  ].filter((l): l is { label: string; href: string } => Boolean(l.href))

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ListHeader
        eyebrow={
          <Link href={`/${slug}/candidates`} className="hover:text-foreground">
            Candidates
          </Link>
        }
        title={c.user.name ?? c.user.email ?? 'Candidate'}
        description={[c.user.email, c.user.phone].filter(Boolean).join(' · ')}
        actions={
          p?.resumePath ? (
            <Button render={<a href={`/api/profile/${id}/resume`} target="_blank" rel="noopener noreferrer" />}>
              <FileText className="size-4" aria-hidden />
              Open résumé
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="CGPA" value={p?.cgpa ?? null} hint={p?.activeBacklogs ? `${p.activeBacklogs} active backlog${p.activeBacklogs === 1 ? '' : 's'}` : p?.activeBacklogs === 0 ? 'No backlogs' : undefined} icon={GraduationCap} />
        <StatCard label="Exams taken" value={c.results.length} hint={c.pending.length ? `${c.pending.length} pending` : undefined} />
        <StatCard label="Average score" value={avg} suffix={avg === null ? undefined : '%'} icon={Trophy} />
        <StatCard label="Profile" value={percent} suffix="%" hint={p?.completedAt ? 'Registered' : 'Not registered yet'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Panel eyebrow="About" title={p?.headline ?? 'Profile'}>
            <div className="flex items-start gap-4">
              <div className="[&>span]:size-12">
                <Initials name={c.user.name} email={c.user.email} />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                {p?.about ? <p className="leading-relaxed whitespace-pre-wrap">{p.about}</p> : <p className="text-muted-foreground">No summary yet.</p>}
                {links.length ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {links.map((l) => (
                      <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer nofollow" className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline">
                        {l.label} <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </Panel>

          <Panel eyebrow="Academics" title={[p?.degree, p?.branch].filter(Boolean).join(' · ') || 'Not provided'}>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Graduation', p?.graduationYear],
                ['Roll no.', p?.rollNumber],
                ['Class 10', p?.tenthPercent != null ? `${p.tenthPercent}%` : null],
                ['Class 12', p?.twelfthPercent != null ? `${p.twelfthPercent}%` : null],
              ].map(([k, v]) => (
                <div key={String(k)} className="bg-muted/50 rounded-xl px-3 py-2.5">
                  <dt className="text-muted-foreground text-[11px]">{k}</dt>
                  <dd className="siq-numeric mt-0.5 text-sm font-semibold">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
            {p?.education.length ? (
              <ul className="mt-4 flex flex-col gap-2 border-t pt-4 text-sm">
                {p.education.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3">
                    <span>
                      <span className="font-medium">{e.degree}</span>
                      {e.field ? ` · ${e.field}` : ''} <span className="text-muted-foreground">— {e.institution}</span>
                    </span>
                    <span className="text-muted-foreground siq-numeric shrink-0 text-xs">
                      {[e.startYear, e.endYear].filter(Boolean).join('–')} {e.score ? `· ${e.score}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          <Panel eyebrow="Work" title="Projects & experience">
            {!p?.projects.length && !p?.experience.length ? (
              <p className="text-muted-foreground text-sm">Nothing added yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {p?.experience.map((x) => (
                  <div key={x.id} className="flex gap-3">
                    <Briefcase className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {x.role} <span className="text-muted-foreground font-normal">at {x.company}</span>
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {x.kind.replace('_', '-').toLowerCase()} · {monthYear(x.startDate) ?? '?'} – {x.current ? 'present' : (monthYear(x.endDate) ?? '?')}
                      </p>
                      {x.description ? <p className="mt-1 leading-relaxed whitespace-pre-wrap">{x.description}</p> : null}
                    </div>
                  </div>
                ))}
                {p?.projects.map((x) => (
                  <div key={x.id} className="flex gap-3">
                    <FolderGit2 className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">
                        {x.url ? (
                          <a href={x.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-primary">
                            {x.title}
                          </a>
                        ) : (
                          x.title
                        )}
                      </p>
                      {x.techStack.length ? <p className="text-muted-foreground text-xs">{x.techStack.join(' · ')}</p> : null}
                      {x.description ? <p className="mt-1 leading-relaxed whitespace-pre-wrap">{x.description}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel eyebrow="Exams" title={`History at ${org.name}`} bodyClassName="px-3 pb-3">
            {c.results.length === 0 && c.pending.length === 0 ? (
              <p className="text-muted-foreground px-2 text-sm">No exams assigned yet.</p>
            ) : (
              <ul className="flex flex-col">
                {c.pending.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.assessment.title}</span>
                    <Pill tone={a.status === 'STARTED' ? 'warning' : 'muted'}>{a.status === 'STARTED' ? 'In progress' : 'Not started'}</Pill>
                  </li>
                ))}
                {c.results.map((r) => (
                  <li key={r.id}>
                    <Link href={`/${slug}/assessments/${r.assessment.id}/results/${r.id}/grade`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.assessment.title}</span>
                      <StatusPill status={r.status} percentage={r.percentage} passed={r.passed} />
                      <span className="text-muted-foreground w-16 text-right text-xs">{timeAgo(r.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel eyebrow="Skills" title={`${p?.skills.length ?? 0} skills`}>
            {p?.skills.length ? (
              <div className="flex flex-wrap gap-1.5">
                {p.skills.map((s) => (
                  <span key={s} className="bg-accent text-accent-foreground rounded-md px-2 py-0.5 text-xs font-medium">
                    {s}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">None listed.</p>
            )}
          </Panel>

          <Panel eyebrow="Wants" title="Preferences">
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Roles</dt>
                <dd>{p?.preferredRoles.join(', ') || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Locations</dt>
                <dd>{p?.preferredLocations.join(', ') || '—'}</dd>
              </div>
              <div className="flex gap-6">
                <div>
                  <dt className="text-muted-foreground text-xs">Relocate</dt>
                  <dd>{p?.openToRelocate == null ? '—' : p.openToRelocate ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Expected CTC</dt>
                  <dd className="siq-numeric">{p?.expectedCtcLpa != null ? `${p.expectedCtcLpa} LPA` : '—'}</dd>
                </div>
              </div>
            </dl>
          </Panel>

          {p?.achievements.length ? (
            <Panel eyebrow="Recognition" title="Achievements">
              <ul className="flex flex-col gap-2 text-sm">
                {p.achievements.map((a) => (
                  <li key={a.id}>
                    <p className="font-medium">{a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-primary">{a.title}</a> : a.title}</p>
                    <p className="text-muted-foreground text-xs">{[a.issuer, monthYear(a.date)].filter(Boolean).join(' · ')}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel eyebrow="Groups" title="Batches">
            {c.batches.length ? (
              <div className="flex flex-wrap gap-1.5">
                {c.batches.map((b) => (
                  <Link key={b.id} href={`/${slug}/candidates/batches/${b.id}`} className="bg-muted hover:bg-accent rounded-md px-2 py-0.5 text-xs transition-colors">
                    {b.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Not in a batch.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}

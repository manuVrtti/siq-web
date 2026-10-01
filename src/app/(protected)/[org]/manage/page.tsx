import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, ArrowRight, Building2, ClipboardCheck, GraduationCap, Send, ShieldCheck, UserRound, Users } from 'lucide-react'

import { StatCard } from '@/components/analytics/stat-card'
import { getCollegeOverview } from '@/services/college-admin'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'College admin — SelectIQ' }

export default async function ManageOverviewPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const org = await getOrgBySlug(slug)
  if (!org) notFound()
  const o = await getCollegeOverview(org.id)
  const base = `/${slug}`

  const attention = [
    o.admins < 2 && {
      text: o.admins === 0 ? 'No College Admin — add one so the college is never locked out.' : 'Only one College Admin. Add a second so you’re never locked out.',
      href: `${base}/manage/people`,
      cta: 'Add an admin',
    },
    o.departments === 0 && { text: 'No departments yet — HODs and students are organised by department.', href: `${base}/manage/departments`, cta: 'Add departments' },
    o.hodsNoDept > 0 && { text: `${o.hodsNoDept} HOD${o.hodsNoDept === 1 ? ' has' : 's have'} no department, so they see nothing.`, href: `${base}/manage/people`, cta: 'Give departments' },
    o.unassigned > 0 && o.departments > 0 && {
      text: `${o.unassigned} student${o.unassigned === 1 ? ' isn’t' : 's aren’t'} in a department — only College Admins see them.`,
      href: `${base}/candidates?dept=none`,
      cta: 'Assign them',
    },
    o.staffPending > 0 && { text: `${o.staffPending} staff invite${o.staffPending === 1 ? '' : 's'} not accepted yet (they haven’t signed in).`, href: `${base}/manage/people`, cta: 'Review' },
  ].filter(Boolean) as { text: string; href: string; cta: string }[]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Students" value={o.students.toLocaleString('en-IN')} hint={`${o.studentsPending} yet to sign in`} icon={GraduationCap} />
        <StatCard label="Team" value={o.admins + o.hods} hint={`${o.admins} admin${o.admins === 1 ? '' : 's'} · ${o.hods} HOD${o.hods === 1 ? '' : 's'}`} icon={ShieldCheck} />
        <StatCard label="Departments" value={o.departments} hint={o.unassigned ? `${o.unassigned} students unassigned` : 'every student placed'} icon={Building2} />
        <StatCard label="Live tests" value={o.published} hint={`${o.submitted7d} submissions this week`} icon={ClipboardCheck} />
      </div>

      {attention.length ? (
        <section className="siq-card siq-rise border-warning/40 overflow-hidden">
          <div className="bg-warning/5 flex items-center gap-2 border-b px-5 py-3">
            <AlertTriangle className="text-warning size-4" aria-hidden />
            <h2 className="text-sm font-semibold">Needs your attention</h2>
          </div>
          <ul className="divide-y">
            {attention.map((a) => (
              <li key={a.text} className="siq-row flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
                <p className="flex-1 text-sm">{a.text}</p>
                <Link href={a.href} className="text-primary group inline-flex items-center gap-1 text-sm font-semibold hover:underline">
                  {a.cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="siq-card siq-rise overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-[15px] font-semibold">Departments</h2>
          <Link href={`${base}/manage/departments`} className="text-primary text-xs font-semibold hover:underline">
            Manage
          </Link>
        </div>
        {o.depts.length === 0 ? (
          <p className="text-muted-foreground px-5 py-6 text-sm">No departments yet.</p>
        ) : (
          <ul className="grid divide-y sm:grid-cols-2 sm:divide-y-0">
            {o.depts.map((d) => (
              <li key={d.id} className="flex items-center gap-3 px-5 py-3.5 sm:border-b">
                <span className="bg-primary text-primary-foreground grid h-9 min-w-9 place-items-center rounded-lg px-1.5 text-[11px] font-bold">{d.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    <Users className="mr-1 inline size-3" aria-hidden />
                    {d._count.members} students ·{' '}
                    {d.heads.length ? (
                      <>
                        <UserRound className="mr-0.5 inline size-3" aria-hidden />
                        {d.heads.map((h) => h.user.name ?? h.user.email).join(', ')}
                      </>
                    ) : (
                      <span className="text-warning font-medium">no HOD</span>
                    )}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: `${base}/candidates/import`, icon: Users, t: 'Import students', b: 'Roster spreadsheet or a pasted list.' },
          { href: `${base}/assessments/new`, icon: ClipboardCheck, t: 'Create a test', b: 'From the shared question bank.' },
          { href: `${base}/analytics`, icon: Send, t: 'College analytics', b: 'Every department, every test.' },
        ].map((q) => (
          <Link key={q.href} href={q.href} className="siq-card siq-lift group flex items-start gap-3 p-4">
            <span className="bg-accent text-primary grid size-9 shrink-0 place-items-center rounded-xl">
              <q.icon className="size-4" aria-hidden />
            </span>
            <span>
              <span className="group-hover:text-primary block text-sm font-semibold transition-colors">{q.t}</span>
              <span className="text-muted-foreground block text-xs">{q.b}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Building2, ClipboardCheck, FolderKanban, GraduationCap, LineChart, Plus, UserRound } from 'lucide-react'

import { Bar } from '@/components/motion/animated'
import { AccessMatrix } from '@/components/people/access-matrix'
import { PageIntro } from '@/components/student/page-intro'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getScope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { round } from '@/services/analytics/stats'
import { getOrgBySlug } from '@/services/organizations'

export const metadata: Metadata = { title: 'My department — SelectIQ' }

/**
 * HOD panel — the department(s) this HOD heads, each with its own health
 * numbers and shortcuts into the (already department-scoped) tools.
 */
export default async function DepartmentPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const user = (await getCurrentUser())!
  if (user.role !== 'COLLEGE_HOD') notFound()
  const org = await getOrgBySlug(slug)
  if (!org) notFound()
  const scope = await getScope(user, org.id)
  const ids = scope.all ? [] : scope.departmentIds

  const depts = await prisma.department.findMany({
    where: { orgId: org.id, id: { in: ids } },
    orderBy: { code: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      heads: { select: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { batches: true, assessments: true, members: { where: { user: { role: 'STUDENT' } } } } },
    },
  })

  const stats = await Promise.all(
    depts.map(async (d) => {
      const inDept = { user: { memberships: { some: { orgId: org.id, departmentId: d.id } } } }
      const [pending, agg, decided, passed] = await Promise.all([
        prisma.organizationMember.count({ where: { orgId: org.id, departmentId: d.id, user: { role: 'STUDENT', firebaseUid: { startsWith: 'pending:' } } } }),
        prisma.result.aggregate({ where: { status: 'GRADED', assessment: { orgId: org.id }, ...inDept }, _avg: { percentage: true }, _count: { _all: true } }),
        prisma.result.count({ where: { status: 'GRADED', passed: { not: null }, assessment: { orgId: org.id }, ...inDept } }),
        prisma.result.count({ where: { status: 'GRADED', passed: true, assessment: { orgId: org.id }, ...inDept } }),
      ])
      return {
        pending,
        graded: agg._count._all,
        avg: round(agg._avg.percentage ?? null),
        passRate: decided ? Math.round((passed / decided) * 100) : null,
      }
    }),
  )

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <PageIntro
        icon={Building2}
        title="My department"
        subtitle={depts.length ? `You head ${depts.map((d) => d.code).join(', ')} at ${org.name}.` : `You don’t head a department at ${org.name} yet.`}
      />

      {depts.length === 0 ? (
        <section className="siq-card siq-rise flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="bg-highlight-tint text-highlight-foreground grid size-12 place-items-center rounded-2xl">
            <Building2 className="size-6" aria-hidden />
          </span>
          <p className="text-base font-semibold">Waiting for a department</p>
          <p className="text-muted-foreground max-w-md text-sm">
            Your College Admin assigns HODs to departments. Once they do, your students, tests and results appear here — and only yours.
          </p>
        </section>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {depts.map((d, i) => {
            const s = stats[i]!
            const coHeads = d.heads.filter((h) => h.user.id !== user.id)
            return (
              <article key={d.id} className="siq-card siq-rise flex flex-col overflow-hidden" style={{ animationDelay: `${i * 70}ms` }}>
                <div className="bg-primary text-primary-foreground relative overflow-hidden p-5">
                  <div className="siq-dots pointer-events-none absolute inset-0 opacity-40" aria-hidden />
                  <div className="relative flex items-center gap-3">
                    <span className="bg-highlight text-highlight-foreground rounded-lg px-2.5 py-1 text-sm font-bold">{d.code}</span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{d.name}</p>
                      <p className="text-xs text-white/70">
                        {coHeads.length ? `With ${coHeads.map((h) => h.user.name ?? h.user.email).join(', ')}` : 'You’re the only HOD'}
                      </p>
                    </div>
                  </div>
                </div>
                <dl className="grid grid-cols-3 divide-x border-b text-center">
                  {[
                    ['Students', d._count.members, s.pending ? `${s.pending} not signed in` : 'all signed in'],
                    ['Tests', d._count.assessments, `${d._count.batches} batches`],
                    ['Avg score', s.avg === null ? '—' : `${s.avg}%`, `${s.graded} graded`],
                  ].map(([l, v, h]) => (
                    <div key={l as string} className="px-2 py-4">
                      <dd className="font-display text-2xl font-semibold">{v}</dd>
                      <dt className="text-muted-foreground text-xs">{l}</dt>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">{h}</p>
                    </div>
                  ))}
                </dl>
                <div className="px-5 py-4">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-muted-foreground">Pass rate</span>
                    <span className="font-semibold">{s.passRate === null ? 'No pass marks yet' : `${s.passRate}%`}</span>
                  </div>
                  <Bar percent={s.passRate ?? 0} />
                </div>
                <div className="mt-auto grid grid-cols-2 gap-2 border-t p-4 sm:grid-cols-4">
                  {[
                    { href: `/${slug}/candidates?dept=${d.id}`, icon: GraduationCap, l: 'Students' },
                    { href: `/${slug}/candidates/batches`, icon: FolderKanban, l: 'Batches' },
                    { href: `/${slug}/assessments/new`, icon: Plus, l: 'New test' },
                    { href: `/${slug}/analytics`, icon: LineChart, l: 'Analytics' },
                  ].map((q) => (
                    <Link key={q.l} href={q.href} className="hover:bg-muted flex flex-col items-center gap-1 rounded-xl py-2.5 text-xs font-medium transition-colors">
                      <q.icon className="text-primary size-4" aria-hidden />
                      {q.l}
                    </Link>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href={`/${slug}/assessments`} className="siq-card siq-lift group flex items-center gap-3 p-4">
          <ClipboardCheck className="text-primary size-5" aria-hidden />
          <span className="flex-1 text-sm font-semibold">Your department’s tests</span>
          <ArrowRight className="text-muted-foreground size-4" aria-hidden />
        </Link>
        <Link href={`/${slug}/results`} className="siq-card siq-lift group flex items-center gap-3 p-4">
          <UserRound className="text-primary size-5" aria-hidden />
          <span className="flex-1 text-sm font-semibold">Results &amp; grading</span>
          <ArrowRight className="text-muted-foreground size-4" aria-hidden />
        </Link>
      </div>

      <AccessMatrix highlight="hod" />
    </div>
  )
}

import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Plus, Rocket } from 'lucide-react'

import { Pill } from '@/components/dashboard/bits'
import { ListHeader } from '@/components/data/list-header'
import { DRIVE_STATUS, EmployerMark, fmtDate } from '@/components/mock-drives/bits'
import { Button } from '@/components/ui/button'
import { requireDrivePage } from '@/lib/auth/drive-page'
import { listDrives } from '@/services/mock-drives'

export const metadata: Metadata = { title: 'Mock drives — SelectIQ' }

/** Plan 023 — the college's mock placement drives (HODs: those that include their departments). */
export default async function MockDrivesPage({ params }: { params: Promise<{ org: string }> }) {
  const { org: slug } = await params
  const { org, scope } = await requireDrivePage(slug)
  const drives = await listDrives(scope)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <ListHeader
        eyebrow={org.name}
        title="Mock drives"
        description="Simulated placement drives: rounds of your tests with cutoffs, so students feel a real drive before the real one."
        actions={
          <Button render={<Link href={`/${slug}/mock-drives/new`} />}>
            <Plus className="size-4" aria-hidden /> New mock drive
          </Button>
        }
      />
      {drives.length === 0 ? (
        <section className="siq-card siq-rise flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="bg-primary/10 text-primary grid size-12 place-items-center rounded-2xl">
            <Rocket className="size-6" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">Run your first mock drive</h2>
          <p className="text-muted-foreground max-w-md text-sm">
            Pick an employer (made-up is fine), add rounds from your tests — e.g. Aptitude → Technical — set cutoffs, and open registration.
          </p>
          <Button render={<Link href={`/${slug}/mock-drives/new`} />}>Create a mock drive</Button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {drives.map((d, i) => {
            const st = DRIVE_STATUS[d.status]!
            return (
              <Link key={d.id} href={`/${slug}/mock-drives/${d.id}`} className="siq-card siq-lift siq-rise group flex flex-col gap-4 p-5" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <div className="flex items-start gap-3">
                  <EmployerMark name={d.employerName} logo={d.employerLogo} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{d.title}</p>
                    <p className="text-muted-foreground truncate text-sm">
                      {d.employerName} · {d.roleTitle}
                    </p>
                  </div>
                  <Pill tone={st.tone}>{st.label}</Pill>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    <b className="text-foreground">{d.rounds.length}</b> round{d.rounds.length === 1 ? '' : 's'}
                  </span>
                  <span>
                    <b className="text-foreground">{d._count.registrations}</b> registered
                  </span>
                  <span>{d.targets.length ? d.targets.map((t) => t.department.code).join(', ') : 'Whole college'}</span>
                  {d.startDate ? <span>Starts {fmtDate(d.startDate)}</span> : null}
                </div>
                <span className="text-primary mt-auto inline-flex items-center gap-1 text-sm font-medium">
                  Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

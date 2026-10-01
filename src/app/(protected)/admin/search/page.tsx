import type { Metadata } from 'next'
import Link from 'next/link'
import { Building2, Search, UserRound, Users } from 'lucide-react'

import { Initials, Pill } from '@/components/dashboard/bits'
import { ROLE_LABEL } from '@/constants/labels'
import { searchConsole } from '@/services/console'

export const metadata: Metadata = { title: 'Search — Platform console — SelectIQ' }

/** Global search across organizations, people and departments (ABtalks /admin/search pattern). */
export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim()
  const r = await searchConsole(q)
  const total = r.orgs.length + r.people.length + r.departments.length

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <form action="/admin/search" className="siq-rise flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search</span>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search colleges, people (name, email, phone) or departments…"
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-12 w-full rounded-xl border pr-4 pl-12 text-sm outline-none focus-visible:ring-3"
          />
        </label>
        <button type="submit" className="bg-primary text-primary-foreground h-12 rounded-xl px-6 text-sm font-semibold">
          Search
        </button>
      </form>

      {q.length > 0 && q.length < 2 ? <p className="text-muted-foreground text-sm">Type at least two characters.</p> : null}
      {q.length >= 2 ? (
        <p className="text-muted-foreground text-sm">
          {total} result{total === 1 ? '' : 's'} for “{q}”
        </p>
      ) : null}

      {q.length >= 2 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Group title="Colleges & companies" icon={Building2} empty="No organizations">
            {r.orgs.map((o) => (
              <Link key={o.id} href={`/admin/organizations/${o.id}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
                <Building2 className="text-muted-foreground size-4" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{o.name}</span>
                  <span className="text-muted-foreground block text-xs">
                    /{o.slug}
                    {o.city ? ` · ${o.city}` : ''}
                  </span>
                </span>
                {o.status === 'SUSPENDED' ? <Pill tone="danger">Suspended</Pill> : null}
              </Link>
            ))}
          </Group>
          <Group title="People" icon={Users} empty="No people">
            {r.people.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
                <Initials name={u.name} email={u.email} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{u.name ?? u.email}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {u.email}
                    {u.memberships[0] ? ` · ${u.memberships[0].org.name}` : ''}
                  </span>
                </span>
                {u.suspendedAt ? <Pill tone="danger">Suspended</Pill> : <Pill tone="muted">{ROLE_LABEL[u.role]}</Pill>}
              </Link>
            ))}
          </Group>
          <Group title="Departments" icon={UserRound} empty="No departments">
            {r.departments.map((d) => (
              <Link key={d.id} href={`/admin/organizations/${d.org.id}?tab=departments`} className="hover:bg-muted/60 flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors">
                <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-[11px] font-bold">{d.code}</span>
                <span className="min-w-0 flex-1 truncate text-sm">
                  {d.name} <span className="text-muted-foreground">· {d.org.name}</span>
                </span>
              </Link>
            ))}
          </Group>
        </div>
      ) : null}
    </div>
  )
}

function Group({ title, icon: Icon, empty, children }: { title: string; icon: typeof Users; empty: string; children: React.ReactNode[] }) {
  return (
    <section className="siq-card siq-rise overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="text-primary size-4" aria-hidden />
        <h2 className="text-sm font-semibold">
          {title} <span className="text-muted-foreground font-normal">· {children.length}</span>
        </h2>
      </div>
      <div className="p-2">{children.length ? children : <p className="text-muted-foreground px-3 py-4 text-sm">{empty}</p>}</div>
    </section>
  )
}

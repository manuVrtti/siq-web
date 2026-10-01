'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Building2, LayoutDashboard, Settings, Users } from 'lucide-react'

import { cn } from '@/lib/utils'

/** Sub-navigation of the College Admin panel. */
export function ManageTabs({ slug }: { slug: string }) {
  const pathname = usePathname()
  const base = `/${slug}/manage`
  const tabs = [
    { href: base, label: 'Overview', icon: LayoutDashboard, exact: true },
    { href: `${base}/people`, label: 'People', icon: Users },
    { href: `${base}/departments`, label: 'Departments', icon: Building2 },
    { href: `${base}/settings`, label: 'Settings', icon: Settings },
  ]
  return (
    <nav aria-label="College admin" className="bg-muted/70 flex w-full gap-1 overflow-x-auto rounded-2xl p-1 sm:w-fit">
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-medium transition-all',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}

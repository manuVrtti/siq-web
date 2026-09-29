import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { hrefWith } from '@/components/data/table-params'
import { cn } from '@/lib/utils'

/**
 * Plan 019 Phase 3 — the table kit every list page shares.
 *
 * Server components only: sorting and paging are plain links built by
 * `hrefWith`, so they work without JavaScript and are crawl-safe. Row height
 * and padding come from these constants so every table in the product has
 * the same density.
 */

export const TH = 'text-muted-foreground px-4 py-2.5 text-left text-xs font-medium whitespace-nowrap'
export const TD = 'px-4 py-3 align-middle'

export function DataTable({
  children,
  minWidth = 720,
  footer,
}: {
  children: ReactNode
  minWidth?: number
  footer?: ReactNode
}) {
  return (
    <div className="siq-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth }}>
          {children}
        </table>
      </div>
      {footer ? <div className="border-t px-4 py-3">{footer}</div> : null}
    </div>
  )
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-muted/50 border-b">
      <tr>{children}</tr>
    </thead>
  )
}

export function TRow({
  children,
  href,
  className,
}: {
  children: ReactNode
  /** Makes the whole row a click target (first cell carries the real link). */
  href?: string
  className?: string
}) {
  return (
    <tr
      className={cn(
        'border-b transition-colors last:border-0',
        href && 'hover:bg-muted/40',
        className,
      )}
    >
      {children}
    </tr>
  )
}

/** Column header that toggles sort. Default direction for a new column is desc. */
export function SortHeader({
  label,
  field,
  pathname,
  params,
  align = 'left',
}: {
  label: string
  field: string
  pathname: string
  params: { sort: string; dir: 'asc' | 'desc'; raw: Record<string, string> }
  align?: 'left' | 'right'
}) {
  const active = params.sort === field
  const nextDir = active && params.dir === 'desc' ? 'asc' : 'desc'
  const Icon = !active ? ArrowUpDown : params.dir === 'desc' ? ArrowDown : ArrowUp
  return (
    <th className={cn(TH, align === 'right' && 'text-right')} aria-sort={
      active ? (params.dir === 'asc' ? 'ascending' : 'descending') : 'none'
    }>
      <Link
        href={hrefWith(pathname, params.raw, { sort: field, dir: nextDir })}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-1 transition-colors',
          active && 'text-foreground',
        )}
        scroll={false}
      >
        {label}
        <Icon className={cn('size-3', !active && 'opacity-40')} aria-hidden />
      </Link>
    </th>
  )
}

export function Pagination({
  pathname,
  params,
  total,
}: {
  pathname: string
  params: { page: number; pageSize: number; raw: Record<string, string> }
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / params.pageSize))
  const from = total === 0 ? 0 : (params.page - 1) * params.pageSize + 1
  const to = Math.min(total, params.page * params.pageSize)
  const prev = params.page > 1 ? hrefWith(pathname, params.raw, { page: String(params.page - 1) }) : null
  const next = params.page < pages ? hrefWith(pathname, params.raw, { page: String(params.page + 1) }) : null

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <p className="text-muted-foreground">
        {total === 0 ? (
          'No rows'
        ) : (
          <>
            Showing <span className="siq-numeric text-foreground">{from}</span>–
            <span className="siq-numeric text-foreground">{to}</span> of{' '}
            <span className="siq-numeric text-foreground">{total.toLocaleString('en-IN')}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        <PageLink href={prev} label="Previous page">
          <ChevronLeft className="size-4" aria-hidden />
        </PageLink>
        <span className="text-muted-foreground siq-numeric px-2">
          {params.page} / {pages}
        </span>
        <PageLink href={next} label="Next page">
          <ChevronRight className="size-4" aria-hidden />
        </PageLink>
      </div>
    </div>
  )
}

function PageLink({ href, label, children }: { href: string | null; label: string; children: ReactNode }) {
  const cls = 'grid size-8 place-items-center rounded-md border transition-colors'
  if (!href) {
    return (
      <span className={cn(cls, 'text-muted-foreground/40')} aria-disabled aria-label={label}>
        {children}
      </span>
    )
  }
  return (
    <Link href={href} className={cn(cls, 'hover:bg-muted')} aria-label={label} scroll={false}>
      {children}
    </Link>
  )
}

/** Empty state that sits inside a table card — distinguishes "none" from "none match". */
export function TableEmpty({
  filtered,
  clearHref,
  icon,
  title,
  body,
  action,
}: {
  filtered: boolean
  clearHref: string
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="siq-card flex flex-col items-center gap-2 px-6 py-14 text-center">
      <span className="bg-accent text-primary grid size-11 place-items-center rounded-xl">{icon}</span>
      <p className="mt-1 text-sm font-medium">{filtered ? 'Nothing matches these filters' : title}</p>
      <p className="text-muted-foreground max-w-sm text-xs">
        {filtered ? 'Try a different search, or clear the filters.' : body}
      </p>
      <div className="mt-2">
        {filtered ? (
          <Link href={clearHref} className="text-primary text-xs font-medium hover:underline">
            Clear filters
          </Link>
        ) : (
          action
        )}
      </div>
    </div>
  )
}

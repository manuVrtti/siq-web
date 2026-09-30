'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Plan 019 Phase 3 — search + select filters for list pages.
 *
 * Owns nothing but the URL: every change rewrites the query string and the
 * server page re-renders with the new results. Search is debounced (300 ms)
 * so typing a name doesn't fire a request per keystroke. Changing any filter
 * drops `page` so you never land on an empty page 7.
 */

export type FilterDef = {
  key: string
  label: string
  options: { value: string; label: string }[]
}

export function FilterBar({
  searchPlaceholder = 'Search…',
  filters = [],
  children,
  showSearch = true,
}: {
  searchPlaceholder?: string
  /** Hide the search box for lists that only filter (e.g. the audit log). */
  showSearch?: boolean
  filters?: FilterDef[]
  /** Right-aligned extras (e.g. a primary action button). */
  children?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [q, setQ] = useState(searchParams.get('q') ?? '')
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function push(patch: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (!v) next.delete(k)
      else next.set(k, v)
    }
    next.delete('page')
    const qs = next.toString()
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    })
  }

  function onSearch(value: string) {
    setQ(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => push({ q: value.trim() || null }), 300)
  }

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current)
  }, [])

  const activeCount =
    filters.filter((f) => searchParams.get(f.key)).length + (searchParams.get('q') ? 1 : 0)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className={cn('relative min-w-0 flex-1 sm:max-w-sm', !showSearch && 'hidden')}>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-9 w-full rounded-lg border pr-8 pl-9 text-sm outline-none transition-shadow focus-visible:ring-3"
        />
        {pending ? (
          <Loader2
            className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin"
            aria-hidden
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.map((f) => {
          const value = searchParams.get(f.key) ?? ''
          return (
            <select
              key={f.key}
              value={value}
              onChange={(e) => push({ [f.key]: e.target.value || null })}
              aria-label={f.label}
              className={cn(
                'border-input bg-card focus-visible:border-ring h-9 rounded-lg border px-3 text-sm outline-none',
                value ? 'text-foreground border-primary/40' : 'text-muted-foreground',
              )}
            >
              <option value="">{f.label}: all</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {f.label}: {o.label}
                </option>
              ))}
            </select>
          )
        })}

        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              setQ('')
              const next = new URLSearchParams(searchParams.toString())
              for (const f of filters) next.delete(f.key)
              next.delete('q')
              next.delete('page')
              const qs = next.toString()
              startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
            }}
            className="text-muted-foreground hover:text-foreground inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium"
          >
            <X className="size-3.5" aria-hidden />
            Clear
          </button>
        ) : null}
      </div>

      {children ? <div className="flex gap-2 sm:ml-auto">{children}</div> : null}
    </div>
  )
}

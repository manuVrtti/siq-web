/**
 * Plan 019 Phase 3 — URL-driven table state.
 *
 * Every list page (questions, candidates, assessments, results) keeps its
 * search / filters / sort / page in the query string. That makes a filtered
 * view bookmarkable and shareable ("send me the failed candidates in Batch
 * A"), survives refresh, and lets the page stay a server component — the
 * filter bar only rewrites the URL.
 */

export type SearchParams = Record<string, string | string[] | undefined>

export type TableParams<S extends string> = {
  q: string
  page: number
  pageSize: number
  sort: S
  dir: 'asc' | 'desc'
  skip: number
  /** Raw single-value params, for page-specific filters. */
  get: (key: string) => string | undefined
  raw: Record<string, string>
}

export function parseTableParams<S extends string>(
  sp: SearchParams,
  opts: { sortable: readonly S[]; defaultSort: S; defaultDir?: 'asc' | 'desc'; pageSize?: number },
): TableParams<S> {
  const raw: Record<string, string> = {}
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v
    if (val !== undefined && val !== '') raw[k] = val
  }
  const pageSize = opts.pageSize ?? 25
  const page = Math.max(1, Number.parseInt(raw.page ?? '1', 10) || 1)
  const sort = (opts.sortable as readonly string[]).includes(raw.sort ?? '')
    ? (raw.sort as S)
    : opts.defaultSort
  const dir = raw.dir === 'asc' || raw.dir === 'desc' ? raw.dir : (opts.defaultDir ?? 'desc')
  return {
    q: (raw.q ?? '').slice(0, 200),
    page,
    pageSize,
    sort,
    dir,
    skip: (page - 1) * pageSize,
    get: (key) => raw[key],
    raw,
  }
}

/**
 * Build a link to the same page with some params changed. `null` removes a
 * key. Any change other than `page` resets to page 1, so a new filter never
 * lands you on an empty page 7.
 */
export function hrefWith(
  pathname: string,
  current: Record<string, string>,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(current)
  let resetPage = false
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === '') next.delete(k)
    else next.set(k, v)
    if (k !== 'page') resetPage = true
  }
  if (resetPage) next.delete('page')
  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

# Plan 044 — Search & Discovery Infrastructure

## 1. Objective

Build unified, performant search across the platform — questions, assessments, jobs, candidates, companies — replacing scattered per-feature queries with a consistent, indexed search layer using PostgreSQL full-text search.

## 2. Scope

- PostgreSQL full-text search setup (tsvector, GIN indexes)
- Unified search service with per-entity scoping
- Global search UI (command palette style)
- Faceted filtering standardization
- Search result ranking and highlighting
- Search performance optimization for the growing schema

### Out of Scope

- External search engine (Elasticsearch/Algolia) — Postgres FTS is sufficient at this scale
- Semantic/vector search (Sprint 6, if needed)
- Search analytics (future)

## 3. Prerequisites / Dependencies

- Sprints 1–3 complete (entities to search)
- Plan 25 (candidate search — this generalizes and optimizes it)
- Existing Prisma-managed Postgres (Supabase)

## 4. Technical Approach

Rather than adding a search vendor, use PostgreSQL's built-in full-text search (`tsvector` + GIN indexes) — it's free, already in the Supabase Postgres, and more than adequate for a campus platform's data volume.

Add generated `tsvector` columns (or expression indexes) to searchable tables via Prisma migrations with raw SQL for the FTS-specific parts (the one sanctioned raw-SQL use, inside migrations only — runtime queries still go through Prisma with `queryRaw` where FTS ranking is needed).

A unified `search()` service dispatches to per-entity searchers, each role- and org-scoped. A global command-palette UI lets users jump to anything they're authorized to see.

## 5. Implementation Steps

1. Add FTS via migration (raw SQL in migration file only):
   - Add `tsvector` columns + triggers (or use generated columns) to: Question, Assessment, JobPosting, Organization, StudentProfile
   - Create GIN indexes on each
   - Example (Question):
     ```sql
     ALTER TABLE "Question" ADD COLUMN search_vector tsvector
       GENERATED ALWAYS AS (
         setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
         setweight(to_tsvector('english', coalesce(body,'')), 'B')
       ) STORED;
     CREATE INDEX question_search_idx ON "Question" USING GIN(search_vector);
     ```
   - Run: `npx prisma migrate dev --name fulltext_search`
   - Note: document that these columns are DB-managed; Prisma schema marks them `Unsupported("tsvector")?` or ignored
2. Create `services/search/search-core.ts`:
   - `buildTsQuery(input)` — sanitize + build `plainto_tsquery` / `websearch_to_tsquery`
   - `rankAndHighlight(...)` — ts_rank ordering, ts_headline snippets
3. Create per-entity searchers:
   - `services/search/question-search.ts` — org-scoped
   - `services/search/assessment-search.ts` — org-scoped
   - `services/search/job-search.ts` — visibility-scoped (students see eligible/targeted; recruiters see own)
   - `services/search/company-search.ts`
   - `services/search/candidate-search.ts` — refactor Plan 25 to use FTS on resume text + structured filters
   - Each uses `prisma.$queryRaw` for the FTS query, respects role/org scope
4. Create `services/search/unified-search.ts`:
   - `search(user, query, scopes?)` — dispatches to authorized entity searchers in parallel, merges + ranks
   - Returns grouped results (by entity type) with counts
5. Create API routes:
   - `/app/api/search/route.ts` — GET (unified, `?q=&types=`)
   - `/app/api/search/[entity]/route.ts` — GET (scoped single-entity search with facets)
6. Create global search UI:
   - `components/search/command-palette.tsx` — Cmd/Ctrl-K launched, keyboard-navigable, grouped results
   - Debounced query, result highlighting, jump-to on select
   - Only shows entities the user's role can access
7. Standardize faceted filtering:
   - `components/search/facet-filters.tsx` — reusable filter sidebar
   - Refactor existing filtered lists (questions, jobs, candidates) to the shared pattern
8. Add Cmd-K trigger to app shell (Plan 08)
9. Performance:
   - Verify GIN index usage (EXPLAIN)
   - Add pagination + result caps

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Migration | FTS columns + GIN indexes | Raw SQL in migration |
| Modify | `prisma/schema.prisma` | Mark tsvector columns |
| Create | `services/search/search-core.ts` | FTS query building |
| Create | `services/search/*-search.ts` | Per-entity searchers |
| Create | `services/search/unified-search.ts` | Dispatcher |
| Modify | `services/candidate-search.ts` | Use FTS |
| Create | `app/api/search/route.ts` | Unified search |
| Create | `app/api/search/[entity]/route.ts` | Entity search |
| Create | `components/search/command-palette.tsx` | Global search UI |
| Create | `components/search/facet-filters.tsx` | Shared facets |
| Modify | `components/layout/app-shell.tsx` | Cmd-K trigger |

## 7. Testing / Verification

- [ ] Cmd-K opens command palette
- [ ] Search "binary tree" → matching questions ranked, highlighted
- [ ] Search returns only entities the user can access (role-scoped)
- [ ] Recruiter searches jobs → only own company's + relevant results
- [ ] Student searches → jobs/companies they can see, no questions/candidates
- [ ] Candidate search (recruiter) uses FTS on resume text
- [ ] GIN index used (EXPLAIN confirms, not seq scan)
- [ ] Faceted filters work on questions, jobs, candidates consistently
- [ ] Highlighted snippets show matched terms
- [ ] Pagination works on large result sets
- [ ] Cross-org results never leak
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: "Postgres FTS for search; FTS SQL lives in migrations only, runtime via `$queryRaw`. This is the ONLY sanctioned raw SQL."
- Add to `CLAUDE.md`: unified search dispatch, scoping rules, command palette
- Add to `docs/project-context.md`: Plan 33 completed, unified search live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes (scoping, ranking, index usage)
- Documentation updates: ~5 minutes

# Plan 030 — Comparative & Trend Analytics

## 1. Objective

Add the cross-cutting analytical depth that all three dashboards draw on: rigorous trend analysis over time, peer/cohort benchmarking, drive-over-drive comparison, and percentile ranking — turning point-in-time snapshots into a narrative of progress that students, HODs, and placement heads can act on.

## 2. Scope

- Time-series competency tracking (per student, department, college)
- Drive-over-drive comparison (did readiness improve between drives?)
- Percentile ranking (student within department/batch/college)
- Peer benchmarking (anonymized cohort distributions)
- Improvement velocity (rate of change, not just direction)
- Batch-year comparison (2025 cohort vs 2026 at same stage)
- Shared analytics primitives consumed by dashboards 26–28

### Out of Scope

- The dashboards themselves (26–28 — this deepens them)
- Exports/reports (Plan 30)
- Predictive forecasting (Phase 2)

## 3. Prerequisites / Dependencies

- Plan 25a (snapshots with timestamps — the time-series source)
- Plan 25b (insights)
- Plans 26–28 (dashboards that consume these — can be built in parallel, integrated here)

## 4. Technical Approach

Plan 25a stores per-assessment and per-drive competency snapshots with timestamps — this plan mines that history for **temporal and comparative** signal that a single snapshot can't provide.

Three analytical lenses, each reusable across all dashboards:
1. **Trend** — trajectory over time (already basic in 25b; here we add velocity, inflection detection, and smoothed series for charts).
2. **Percentile/ranking** — where a student/department stands relative to peers (computed from 25a cumulative competencies + baselines).
3. **Comparison** — structured diffs: this drive vs last, this batch vs last year, this department vs college average.

All of this is computed as reusable services + cached comparative snapshots, so the three dashboards call the same primitives rather than each re-deriving them. This keeps numbers consistent across the student, HOD, and placement-head views (critical — a student's percentile must match what their HOD sees).

## 5. Implementation Steps

1. Add Prisma models (caching comparative results):
   ```prisma
   model CompetencyTimeSeries {
     id            String    @id @default(cuid())
     subjectType   String    // "STUDENT" | "DEPARTMENT" | "COLLEGE"
     subjectId     String
     dimensionType String    // "SECTION" | "SKILL" | "OVERALL"
     dimensionId   String?
     points        Json      // [{ date, score, driveId?, label }]
     velocity      Float?    // recent rate of change
     updatedAt     DateTime  @updatedAt

     @@unique([subjectType, subjectId, dimensionType, dimensionId])
     @@index([subjectType, subjectId])
   }

   model PercentileRank {
     id            String    @id @default(cuid())
     userId        String
     scopeType     String    // "DEPARTMENT" | "BATCH" | "COLLEGE"
     scopeId       String
     dimensionType String    // "SECTION" | "SKILL" | "OVERALL"
     dimensionId   String?
     percentile    Float     // 0-100
     rank          Int
     outOf         Int
     computedAt    DateTime  @default(now())

     user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([userId, scopeType, scopeId, dimensionType, dimensionId])
     @@index([userId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name comparative_analytics`
3. Create `services/analytics/trend-engine.ts`:
   - `buildTimeSeries(subjectType, subjectId, dimension)` — assemble timestamped points from 25a snapshots
   - `computeVelocity(points)` — recent rate of change (improvement speed)
   - `detectInflection(points)` — where trajectory changed (e.g., started improving after drive 2)
   - `smoothSeries(points)` — for clean chart rendering
4. Create `services/analytics/ranking-engine.ts`:
   - `computePercentiles(scopeType, scopeId, dimension)` — rank all students in scope, store PercentileRank
   - `getStudentPercentile(userId, scopeType, dimension)`
   - `getDistribution(scopeType, scopeId, dimension)` — anonymized histogram for peer benchmarking
5. Create `services/analytics/comparison-engine.ts`:
   - `compareDrives(subjectId, driveA, driveB)` — competency diff between two drives
   - `compareBatchYears(collegeOrgId, yearA, yearB, dimension)` — cohort-over-cohort
   - `compareDeptToCollege(departmentId, dimension)` — department vs college average
   - `compareStudentToCohort(userId, dimension)` — student vs peers (powers gentle comparison in Plan 26)
6. Create batch recompute:
   - `refreshComparativeAnalytics(collegeOrgId)` — rebuild time-series, percentiles, distributions (run after drives complete / scheduled)
7. Create API routes:
   - `/app/api/analytics/trend/route.ts` — GET (time-series for a subject+dimension, scoped)
   - `/app/api/analytics/percentile/route.ts` — GET
   - `/app/api/analytics/distribution/route.ts` — GET (anonymized)
   - `/app/api/analytics/compare/drives/route.ts` — GET
   - `/app/api/analytics/compare/batches/route.ts` — GET
   - `/app/api/analytics/refresh/route.ts` — POST (recompute)
8. Enforce scoping: student → own percentile + anonymized distribution; HOD → dept comparisons; placement head → college. Never expose other students' identities in distributions.
9. Integrate into dashboards (26–28):
   - Plan 26 student: add percentile badges, velocity indicator, gentle peer distribution
   - Plan 27 HOD: department-vs-college comparison, cohort velocity
   - Plan 28 placement head: batch-year comparison, department diffs
10. Create shared components:
    - `components/analytics/trend-chart.tsx` (smoothed time-series)
    - `components/analytics/percentile-badge.tsx`
    - `components/analytics/distribution-chart.tsx` (anonymized histogram)
    - `components/analytics/comparison-bars.tsx`
    - `components/analytics/velocity-indicator.tsx`
    - `components/analytics/batch-comparison.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | CompetencyTimeSeries, PercentileRank |
| Create | `services/analytics/trend-engine.ts` | Time-series + velocity |
| Create | `services/analytics/ranking-engine.ts` | Percentiles + distributions |
| Create | `services/analytics/comparison-engine.ts` | Structured comparisons |
| Create | `app/api/analytics/*/route.ts` | Analytics APIs |
| Modify | `app/(protected)/my-competency/*`, `hod/*`, `placement/*` | Integrate comparisons |
| Create | `components/analytics/*.tsx` | Shared comparative UI |

## 7. Testing / Verification

- [ ] Time-series assembles correctly from multiple drive snapshots
- [ ] Velocity: fast-improving student shows higher velocity than slow
- [ ] Inflection detected where trajectory changes
- [ ] Percentile: top student → high percentile within department
- [ ] Same student's percentile identical across student + HOD views (consistency)
- [ ] Distribution histogram is anonymized (no student identities)
- [ ] Drive-over-drive comparison shows correct competency deltas
- [ ] Batch-year comparison (2025 vs 2026) accurate
- [ ] Department-vs-college comparison correct
- [ ] Student sees own percentile + anonymized peer distribution only
- [ ] HOD sees department comparisons, not other departments' student identities improperly
- [ ] Refresh recomputes consistently
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: comparative analytics primitives (trend/ranking/comparison), consistency guarantee across dashboards, anonymized distributions, scoping
- Add to `CLAUDE.md`: "All three dashboards call the SAME comparative services — numbers must match across student/HOD/placement views"
- Add to `docs/project-context.md`: Phase 1 Plan 29 completed, comparative + trend analytics live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~30 minutes (cross-dashboard consistency, anonymization, scoping)
- Documentation updates: ~5 minutes

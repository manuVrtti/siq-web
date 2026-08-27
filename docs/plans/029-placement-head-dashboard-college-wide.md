# Plan 029 — Placement Head Dashboard: College-Wide Tracking

## 1. Objective

Build the Placement Head's college-wide command center — the view that tracks placement readiness across every department, compares departments, monitors all mock drives, surfaces college-wide skill gaps, and identifies both star performers and at-risk students. The third co-equal MVP dashboard.

## 2. Scope

- College-wide readiness overview (all departments)
- Cross-department comparison (which departments are ahead/behind)
- College-wide weak-spot analysis
- All-drives monitor (every mock drive's status + outcomes)
- Department leaderboard / comparison
- At-risk student identification across college
- Batch-year cohort tracking
- Drill-down to any department (reuses HOD views, college-scoped)

### Out of Scope

- Individual student self-view (Plan 26)
- Single-department HOD view (Plan 27 — this is the superset)
- Official exportable reports (Plan 30)
- Real placement outcomes/offers (Phase 2 — this is readiness, not placements-achieved)

## 3. Prerequisites / Dependencies

- Plan 22 (PLACEMENT_HEAD role — college scope)
- Plan 25a + 25b (competency data + aggregates)
- Plan 24 (drives)
- Plan 27 (HOD dashboard components — reused at college scope)

## 4. Technical Approach

The Placement Head sees the whole college — no department filter. This dashboard is the **cross-department** layer: where the HOD asks "how is *my* department?", the placement head asks "how do departments *compare*, and where should I focus college-wide effort?"

Key capability: **department comparison**. A bar/heatmap across departments per section reveals systemic patterns — if every department is weak in Aptitude, that's a college-wide training priority; if one department lags in DSA, that's a targeted intervention.

It reuses Plan 27's aggregate machinery but at college scope (all departments), plus a comparison layer on top. The all-drives monitor gives operational oversight of every mock drive running.

## 5. Implementation Steps

1. Create `services/dashboards/placement-head-dashboard.ts` (college-scoped):
   - `getCollegeOverview(user)` — total students, departments, avg readiness, active drives, overall trend
   - `getDepartmentComparison(user, batchYear?)` — per-department readiness + section breakdown (the comparison matrix)
   - `getCollegeWeakSpots(user)` — wraps 25b at college scope
   - `getAllDrivesStatus(user)` — every mock drive: status, participation, funnel
   - `getDepartmentLeaderboard(user)` — departments ranked by readiness/improvement
   - `getCollegeAtRiskStudents(user)` — students with critical gaps across all departments
   - `getBatchCohortView(user, batchYear)` — cross-department for a batch year
2. Create placement-head dashboard `/app/(protected)/placement/dashboard/page.tsx`:
   - **College readiness header**: total students, avg readiness, active drives, trend
   - **Department comparison**: matrix/heatmap — departments × sections (systemic gap signal)
   - **College weak spots**: top gaps college-wide
   - **All-drives monitor**: every drive's status + funnel at a glance
   - **At-risk summary**: count + link to full list
3. Create `/app/(protected)/placement/departments/page.tsx`:
   - Department comparison deep-dive
   - Leaderboard (readiness, improvement, participation)
   - Per-department cards → drill into that department (reuse Plan 27 views, college-scoped)
4. Create `/app/(protected)/placement/departments/[deptId]/page.tsx`:
   - Full department view (reuses HOD dashboard components, but placement head can see ANY department)
5. Create `/app/(protected)/placement/drives/page.tsx`:
   - All mock drives across college
   - Filters (status, department, batch)
   - Per-drive → monitor (reuse Plan 24 monitor)
   - Create drive (placement head can create college-wide or multi-department drives)
6. Create `/app/(protected)/placement/weak-spots/page.tsx`:
   - College-wide gap analysis
   - Which sections/skills are systemically weak
   - Department breakdown per gap (which departments drive the college weakness)
7. Create `/app/(protected)/placement/at-risk/page.tsx`:
   - All at-risk students college-wide
   - Grouped/filterable by department
   - Actionable triage (which HOD to loop in)
8. Create `/app/(protected)/placement/batches/page.tsx`:
   - Batch-year cohort tracking (2025 vs 2026 readiness)
9. Create components:
   - `components/dashboards/college-overview-header.tsx`
   - `components/competency/department-comparison-matrix.tsx` (the centerpiece)
   - `components/competency/department-leaderboard.tsx`
   - `components/dashboards/all-drives-monitor.tsx`
   - `components/competency/college-weak-spots.tsx`
   - `components/competency/at-risk-summary.tsx`
   - `components/competency/batch-cohort-chart.tsx`
10. Ensure college scoping (placement head = all departments in their college, but NOT other colleges)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `services/dashboards/placement-head-dashboard.ts` | College aggregation |
| Create | `app/(protected)/placement/dashboard/page.tsx` | Placement head dashboard |
| Create | `app/(protected)/placement/departments/page.tsx` | Department comparison |
| Create | `app/(protected)/placement/departments/[deptId]/page.tsx` | Any-dept drill-down |
| Create | `app/(protected)/placement/drives/page.tsx` | All drives |
| Create | `app/(protected)/placement/weak-spots/page.tsx` | College gaps |
| Create | `app/(protected)/placement/at-risk/page.tsx` | At-risk students |
| Create | `app/(protected)/placement/batches/page.tsx` | Batch tracking |
| Create | `components/competency/department-comparison-matrix.tsx` | Centerpiece |
| Create | `components/dashboards/*.tsx`, `components/competency/*.tsx` | UI |
| Modify | `constants/navigation.ts` | Placement head routes |

## 7. Testing / Verification

- [ ] Placement head dashboard loads with college-wide data
- [ ] Department comparison matrix shows all departments × sections
- [ ] Systemic gap (all departments weak in Aptitude) visually clear
- [ ] Targeted gap (one department weak in DSA) visible
- [ ] Department leaderboard ranks correctly
- [ ] All-drives monitor shows every drive's status + funnel
- [ ] College weak spots aggregate correctly across departments
- [ ] Drill into any department → full department view (unlike HOD, not restricted)
- [ ] At-risk list spans all departments, groupable by dept
- [ ] Batch cohort view compares batch years
- [ ] Placement head can create college-wide/multi-dept drives
- [ ] **Placement head CANNOT see another college's data (college boundary)**
- [ ] Mobile responsive for key views
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: placement head dashboard, college scope, department comparison matrix, drill-to-any-department, at-risk triage
- Add to `docs/project-context.md`: Phase 1 Plan 28 completed — **placement head dashboard live (Dashboard #3 of 3) — all three MVP dashboards complete**

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (comparison correctness, drill-downs, college boundary)
- Documentation updates: ~5 minutes

# Plan 028 — HOD Dashboard: Department Cohort

## 1. Objective

Build the HOD's department-scoped analytics dashboard — the view that lets a Head of Department see their students' collective and individual strengths/weaknesses, identify department-wide skill gaps, triage students needing attention, and track cohort readiness across drives. One of the three co-equal MVP dashboards.

## 2. Scope

- Department overview (cohort readiness at a glance)
- Department-wide weak-spot analysis (which topics is the department weak in)
- Section/skill heatmap across the cohort
- Student roster with competency status (sortable, filterable)
- "Students needing attention" triage list
- Individual student drill-down (department students only)
- Cohort trend tracking (is the department improving?)
- Drive participation + performance by department

### Out of Scope

- Student's own view (Plan 26)
- College-wide view (Plan 28 — placement head)
- Cross-department comparison (Plan 28/29)
- Competency computation (25a/25b — this renders, scoped)

## 3. Prerequisites / Dependencies

- Plan 22 (HOD role + department scoping — the access spine)
- Plan 25a + 25b (competency data + aggregate insights)
- Plan 24 (drive participation)

## 4. Technical Approach

This dashboard's defining constraint is **department scoping** — everything the HOD sees is filtered through `scopeStudentsQuery(user)` (Plan 22). An HOD of CSE sees CSE students, full stop.

The HOD's core questions differ from the student's:
- "Where is my *department* collectively weak?" → aggregate weak spots (25b `getDepartmentWeakSpots`)
- "Which *students* need help?" → triage list (25b `getStudentsNeedingAttention`)
- "Is my cohort *improving*?" → cohort trend
- "How did we do in the last drive?" → department drive performance

The centerpiece is a **section/skill heatmap** (students × dimensions, color-coded by tier) that makes department-wide patterns instantly visible — a column that's red across many students is a curriculum-level gap; a row that's red is a student needing attention.

## 5. Implementation Steps

1. Create `services/dashboards/hod-dashboard.ts` (all reads department-scoped via Plan 22):
   - `getDepartmentOverview(user)` — cohort size, avg readiness, strong/weak section summary, drives run
   - `getDepartmentHeatmap(user, batchYear?)` — matrix: students × sections (or skills), tier per cell
   - `getDepartmentWeakSpots(user)` — wraps 25b, scoped: most common weak sections/skills
   - `getAttentionList(user)` — wraps 25b triage: students with most critical gaps
   - `getCohortTrend(user)` — department avg competency over time / across drives
   - `getDepartmentDrivePerformance(user, driveId?)` — how the department fared
   - `getStudentSummaries(user, filters)` — roster with competency status
2. Create HOD dashboard `/app/(protected)/hod/dashboard/page.tsx`:
   - **Cohort readiness header**: dept size, avg readiness, trend arrow
   - **Department weak spots panel**: top gaps across the cohort (curriculum signal)
   - **Section heatmap**: students × sections, tier-colored (the centerpiece)
   - **Attention list**: students needing intervention (prominent, actionable)
   - **Recent drive summary**: department performance in latest drive
3. Create `/app/(protected)/hod/students/page.tsx`:
   - Full department roster
   - Columns: name, batch, overall readiness, weakest section, trend, drives taken
   - Sort/filter (by readiness, weak section, batch)
   - Click → student detail
4. Create `/app/(protected)/hod/students/[userId]/page.tsx` (scoped — dept students only):
   - Individual student's full competency profile (reuses Plan 26 components, HOD context)
   - Strengths/weaknesses, trends, drive history
   - Access enforced: `requireDepartmentAccess` (Plan 22)
5. Create `/app/(protected)/hod/weak-spots/page.tsx`:
   - Deep-dive into department-wide gaps
   - Per-section: how many students weak, distribution
   - Drill to which students are weak in a given skill → targeted intervention lists
6. Create `/app/(protected)/hod/drives/page.tsx`:
   - Drives targeting this department
   - Per-drive: participation, funnel, department performance
7. Create components:
   - `components/dashboards/cohort-readiness-header.tsx`
   - `components/competency/competency-heatmap.tsx` (the centerpiece — students × dimensions)
   - `components/competency/department-weak-spots.tsx`
   - `components/competency/attention-list.tsx`
   - `components/competency/cohort-trend-chart.tsx`
   - `components/dashboards/student-roster-table.tsx`
8. Enforce scoping rigorously: every service call passes `user`, every query uses `scopeStudentsQuery` — add a test that an HOD cannot load another department's student by direct URL/ID
9. Add HOD nav section (Plan 22 already added role; wire dashboard routes)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `services/dashboards/hod-dashboard.ts` | HOD aggregation (scoped) |
| Create | `app/(protected)/hod/dashboard/page.tsx` | HOD dashboard |
| Create | `app/(protected)/hod/students/page.tsx` | Department roster |
| Create | `app/(protected)/hod/students/[userId]/page.tsx` | Student detail (scoped) |
| Create | `app/(protected)/hod/weak-spots/page.tsx` | Department gaps |
| Create | `app/(protected)/hod/drives/page.tsx` | Department drives |
| Create | `components/competency/competency-heatmap.tsx` | Heatmap centerpiece |
| Create | `components/dashboards/*.tsx`, `components/competency/*.tsx` | UI |
| Modify | `constants/navigation.ts` | HOD dashboard routes |

## 7. Testing / Verification

- [ ] HOD dashboard loads scoped to their department only
- [ ] Cohort readiness header accurate for the department
- [ ] Department weak spots show most common gaps across cohort
- [ ] Heatmap renders students × sections, tiers colored correctly
- [ ] Red column (many weak students) identifies curriculum gap
- [ ] Attention list surfaces students with most critical gaps first
- [ ] Cohort trend shows department improving/declining
- [ ] Roster sortable by weakest section, readiness, etc.
- [ ] Drill into a department student → full profile
- [ ] **HOD tries to open another department's student by direct URL → blocked (403)**
- [ ] HOD sees only drives targeting their department
- [ ] Weak-spots drill → list of students weak in a specific skill
- [ ] Empty department → helpful empty state
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: HOD dashboard, department scoping enforcement, heatmap pattern, attention triage
- Add to `CLAUDE.md`: "Every HOD dashboard query is department-scoped — verified by the direct-URL-access test"
- Add to `docs/project-context.md`: Phase 1 Plan 27 completed — **HOD dashboard live (Dashboard #2 of 3)**

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~30 minutes (scoping boundaries are critical — test thoroughly)
- Documentation updates: ~5 minutes

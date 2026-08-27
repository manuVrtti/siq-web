# Plan 031 — Reporting & Export

## 1. Objective

Deliver the shareable, exportable outputs each audience needs to take the analytics off-screen: individual student competency report cards, HOD department reports, placement-head college readiness reports, and mock-drive summary sheets — completing the Phase 1 MVP loop from data to distributable insight.

## 2. Scope

- Student competency report card (PDF) — strengths, weaknesses, trends, recommendations
- HOD department report (PDF + Excel) — cohort readiness, weak spots, attention list
- Placement-head college report (PDF + Excel) — cross-department, drive outcomes, at-risk
- Mock-drive summary report (per drive — funnel, results, standings)
- Bulk export (department roster competency → Excel)
- Report scheduling foundation (on-demand now; scheduled deferred)

### Out of Scope

- Real placement/CTC reports (Phase 2 — no real offers in MVP)
- Automated recurring report emails (Phase 2)
- Custom report builder (Phase 2)

## 3. Prerequisites / Dependencies

- Plans 25a/25b (competency data + insights)
- Plans 26–28 (dashboards — reports mirror their content)
- Plan 29 (comparative analytics — trends/percentiles in reports)
- Sprint 2 Plan 20 (SheetJS + PDF infrastructure — reused)

## 4. Technical Approach

Reports are the "off-screen" counterpart to the dashboards — same data, packaged for sharing, printing, and record-keeping (parent meetings, department reviews, management presentations). We reuse Sprint 2 Plan 20's SheetJS (Excel) and PDF infrastructure with Phase-1-specific templates.

Each report is audience-matched:
- **Student report card** — motivating, visual, one student, take-home. Strengths first, prioritized growth areas, trend, recommendations.
- **HOD department report** — cohort-level, identifies curriculum gaps + students needing attention, for department reviews.
- **Placement-head college report** — executive summary across departments, drive outcomes, for management/accreditation prep.
- **Drive summary** — operational record of a mock drive (funnel, standings, section-wise cohort performance).

All exports respect the same scoping as the dashboards (student=self, HOD=dept, placement head=college). Generation is on-demand (button → generate → download); scheduling is scaffolded but not activated.

## 5. Implementation Steps

1. Create report templates directory `services/reports/`
2. Create `services/reports/student-report-card.ts`:
   - `generateStudentReportCard(userId, format)` — PDF:
     - Header: student name, department, batch, overall readiness
     - Strengths section (top strong sections/skills)
     - Growth areas (prioritized weaknesses from 25b)
     - Section competency chart (radar/bar)
     - Trend chart (from Plan 29)
     - Percentile standing (gentle framing)
     - Recommendations with topics to practice
     - College branding
3. Create `services/reports/department-report.ts`:
   - `generateDepartmentReport(user, format)` — scoped, PDF + Excel:
     - Cohort readiness summary
     - Department weak spots (curriculum signal)
     - Section heatmap (rendered)
     - Attention list (students needing intervention)
     - Cohort trend
     - Excel: full roster with per-section/skill scores
4. Create `services/reports/college-report.ts`:
   - `generateCollegeReport(user, format)` — PDF + Excel:
     - Executive summary (college readiness, departments, drives)
     - Department comparison matrix (rendered)
     - Department leaderboard
     - College-wide weak spots
     - Drive outcomes summary
     - At-risk overview
     - Excel: department-wise breakdown sheets
5. Create `services/reports/drive-summary-report.ts`:
   - `generateDriveSummary(driveId, format)` — PDF + Excel:
     - Drive config (employer, rounds, targets)
     - Funnel (registered → per-round survivors → final shortlist)
     - Section-wise cohort performance in the drive
     - Standings table (Excel)
6. Create chart-to-image helpers for embedding Recharts/visuals into PDFs (server-side render or pre-rendered SVG → PNG)
7. Create API routes (all scoped):
   - `/app/api/reports/student/[userId]/route.ts` — GET (self / HOD-for-dept / placement head)
   - `/app/api/reports/department/route.ts` — GET (HOD / placement head)
   - `/app/api/reports/college/route.ts` — GET (placement head)
   - `/app/api/reports/drive/[id]/route.ts` — GET
   - `/app/api/reports/roster-export/route.ts` — GET (Excel bulk)
8. Add report buttons/actions to dashboards:
   - Plan 26 student: "Download my report card"
   - Plan 27 HOD: "Generate department report", "Export roster"
   - Plan 28 placement head: "Generate college report", per-drive "Export summary"
9. Create `services/reports/scheduling.ts` (scaffold only):
   - Data model + interface for scheduled reports (not activated — Phase 2 wires delivery)
10. Create components:
    - `components/reports/report-generator.tsx` (format picker + generate + download)
    - `components/reports/report-preview.tsx` (optional preview before download)
11. Ensure scoping on every report endpoint (reuse Plan 22 `scopeStudentsQuery` / `requireDepartmentAccess`)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `services/reports/student-report-card.ts` | Student PDF |
| Create | `services/reports/department-report.ts` | Department PDF+Excel |
| Create | `services/reports/college-report.ts` | College PDF+Excel |
| Create | `services/reports/drive-summary-report.ts` | Drive summary |
| Create | `services/reports/chart-render.ts` | Chart → image for PDF |
| Create | `services/reports/scheduling.ts` | Schedule scaffold |
| Create | `app/api/reports/*/route.ts` | Report APIs |
| Modify | `app/(protected)/my-competency/*`, `hod/*`, `placement/*` | Report buttons |
| Create | `components/reports/*.tsx` | Report UI |

## 7. Testing / Verification

- [ ] Student report card PDF → strengths, weaknesses, trend, recommendations, branding
- [ ] Charts render correctly in PDF (not blank)
- [ ] HOD department report PDF → cohort summary, weak spots, attention list
- [ ] HOD roster export Excel → all department students with scores
- [ ] Placement head college report PDF → cross-department, drives, at-risk
- [ ] College report Excel → per-department sheets
- [ ] Drive summary → funnel + standings accurate
- [ ] Student can download own report card; not others'
- [ ] HOD generates dept report scoped to their department only
- [ ] HOD cannot generate another department's report
- [ ] Placement head generates college report + any department
- [ ] Large roster export (500+ students) completes without timeout
- [ ] Numbers in reports match dashboard numbers (consistency)
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: report types per audience, chart-to-PDF rendering, scoping on reports, scheduling scaffold
- Add to `docs/project-context.md`: Phase 1 Plan 30 completed — **Phase 1 MVP complete**: mock drives + three dashboards + diagnostic engine + reporting, full loop from drive to distributable insight
- Phase 1 summary: taxonomy → HOD/departments → mock drive setup → drive runtime → competency engine (scoring + insights) → student/HOD/placement dashboards → comparative analytics → reporting

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~30 minutes (all report types, chart rendering, scoping, consistency)
- Documentation updates: ~10 minutes

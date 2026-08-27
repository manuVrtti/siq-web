# Plan 041 — Recruitment Analytics & Placement Reporting

## 1. Objective

Extend the analytics engine (Plan 19) to cover the full recruitment funnel, giving colleges, companies, and the platform rich placement insights and generating the official placement reports Indian colleges need for accreditation and marketing.

## 2. Scope

- Recruitment funnel analytics (drive → application → offer → placement)
- College placement statistics (placement %, CTC bands, company-wise, branch-wise)
- Company recruitment analytics (funnel efficiency, cost/quality of hire proxies)
- Year-over-year placement trends
- Official placement report generation (PDF/Excel)
- Comparative dashboards (branch, batch, drive)

### Out of Scope

- Predictive analytics (Sprint 6)
- Benchmarking against other colleges (data-sharing concerns — future)
- Real-time drive-day dashboards (Sprint 5)

## 3. Prerequisites / Dependencies

- Plan 19 complete (analytics foundation, Recharts)
- Plan 24 (applications), Plan 27 (placements), Plan 28 (drives)
- Plan 20 (export infra — Excel + PDF)

## 4. Technical Approach

This plan is the recruitment-side counterpart to Plan 19's assessment analytics. It aggregates across the Sprint 3 data model to compute funnel and placement metrics, reusing Plan 19's caching approach and Recharts components.

The marquee deliverable is the **official placement report** — the document colleges publish annually (placement %, highest/average CTC, recruiter list, branch-wise breakdown). This reuses Plan 20's PDF/Excel infra with placement-specific templates.

All analytics are role-scoped: colleges see their placements, companies see their recruitment, SuperAdmin sees platform-wide.

## 5. Implementation Steps

1. Create `services/analytics/recruitment-analytics.ts`:
   - `getFunnelMetrics(scope, scopeId)` — registered → applied → shortlisted → interviewed → offered → placed, with conversion rates at each stage
   - `getDriveAnalytics(driveId)` — per-drive funnel + outcomes
   - `getJobFunnel(jobId)` — single job conversion
2. Create `services/analytics/placement-analytics.ts`:
   - `getPlacementStats(collegeOrgId, batchYear)`:
     - Placement percentage (placed / eligible)
     - CTC: highest, average, median, by band
     - Company count, top recruiters
     - Branch-wise placement %
     - Multiple-offer students
   - `getPlacementTrends(collegeOrgId)` — YoY across batch years
   - `getBranchComparison(collegeOrgId, batchYear)` — branch-wise breakdown
   - `getCTCDistribution(collegeOrgId, batchYear)` — histogram/bands
3. Create `services/analytics/company-recruitment-analytics.ts`:
   - `getCompanyFunnel(companyOrgId)` — applications → hires across all jobs
   - `getCompanyCollegeBreakdown(companyOrgId)` — hires per college
   - `getTimeToHire(companyOrgId)` — avg days application → offer
4. Create official report generation `services/export/placement-report.ts`:
   - `generatePlacementReport(collegeOrgId, batchYear, format)`:
     - PDF: cover, summary stats, branch-wise tables, top recruiters, CTC analysis, charts, college branding
     - Excel: detailed sheets (placed students, company-wise, branch-wise)
5. Create API routes:
   - `/app/api/analytics/recruitment/funnel/route.ts` — GET (scoped)
   - `/app/api/analytics/drives/[id]/route.ts` — GET
   - `/app/api/analytics/placements/route.ts` — GET (college stats)
   - `/app/api/analytics/placements/trends/route.ts` — GET
   - `/app/api/analytics/company-recruitment/route.ts` — GET
   - `/app/api/reports/placement/route.ts` — GET (generate report, format param)
6. Create college pages:
   - `/app/(protected)/college/analytics/page.tsx` — placement analytics dashboard:
     - Funnel visualization
     - Placement % gauge, CTC stats KPIs
     - Branch-wise comparison chart
     - CTC distribution
     - Top recruiters
     - YoY trend
     - "Generate Placement Report" (PDF/Excel)
7. Create company pages:
   - `/app/(protected)/company/analytics/page.tsx` — recruitment funnel, college breakdown, time-to-hire
8. Extend SuperAdmin platform analytics (Plan 19):
   - Platform-wide placement volume, total CTC value, active drives, top colleges/companies by activity
9. Create components:
   - `components/analytics/recruitment-funnel.tsx` (funnel chart with conversion %)
   - `components/analytics/placement-summary.tsx`
   - `components/analytics/ctc-distribution-chart.tsx`
   - `components/analytics/branch-comparison-chart.tsx`
   - `components/analytics/top-recruiters.tsx`
   - `components/analytics/placement-trend.tsx`
   - `components/reports/report-generator.tsx`
10. Add "Analytics" / "Reports" nav items for college + company roles

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `services/analytics/recruitment-analytics.ts` | Funnel metrics |
| Create | `services/analytics/placement-analytics.ts` | Placement stats |
| Create | `services/analytics/company-recruitment-analytics.ts` | Company metrics |
| Create | `services/export/placement-report.ts` | Official report PDF/Excel |
| Create | `app/api/analytics/recruitment/*/route.ts` | Recruitment analytics APIs |
| Create | `app/api/analytics/placements/*/route.ts` | Placement APIs |
| Create | `app/api/analytics/company-recruitment/route.ts` | Company analytics |
| Create | `app/api/reports/placement/route.ts` | Report generation |
| Create | `app/(protected)/college/analytics/page.tsx` | College analytics |
| Create | `app/(protected)/company/analytics/page.tsx` | Company analytics |
| Modify | `app/(protected)/admin/analytics/page.tsx` | Platform placement metrics |
| Create | `components/analytics/*.tsx`, `components/reports/*.tsx` | UI |
| Modify | `constants/navigation.ts` | Analytics/Reports nav |

## 7. Testing / Verification

- [ ] Recruitment funnel shows correct counts + conversion % at each stage
- [ ] Drive analytics aggregate across drive's jobs
- [ ] Placement % computed correctly (placed / eligible)
- [ ] CTC stats (highest, avg, median) accurate
- [ ] Branch-wise breakdown correct
- [ ] CTC distribution histogram renders
- [ ] Top recruiters list accurate
- [ ] YoY trend shows multiple batch years
- [ ] Company funnel + college breakdown correct
- [ ] Time-to-hire computed
- [ ] Generate placement report PDF → branded, complete, accurate
- [ ] Generate placement report Excel → detailed sheets
- [ ] College sees only their placements; company sees only their recruitment
- [ ] SuperAdmin platform metrics accurate
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: recruitment analytics structure, placement metric definitions, official report generation, role scoping
- Add to `docs/project-context.md`: Plan 30 completed — Sprint 3 complete, full recruitment workflow + analytics operational
- Sprint 3 summary: companies → jobs → workflows → applications → search → interviews → offers → drives → student journey → recruitment analytics

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (metrics accuracy, report generation)
- Documentation updates: ~10 minutes

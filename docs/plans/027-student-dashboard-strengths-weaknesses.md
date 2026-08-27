# Plan 027 — Student Dashboard: My Strengths & Weaknesses

## 1. Objective

Build the student's personal analytics dashboard — the view that shows each student their section/skill strengths and weaknesses, drive performance, trends over time, and what to practice next. One of the three co-equal MVP dashboards.

## 2. Scope

- Student home/overview (readiness snapshot)
- Section-level competency view (strong/weak topics at a glance)
- Skill-level drill-down (within each section)
- Trend charts (improvement over time)
- Drive performance history
- Personalized recommendations (from Plan 25b) with practice links
- Cohort comparison ("you vs your batch") — opt-in, non-demoralizing framing

### Out of Scope

- HOD/placement views (Plans 27–28)
- The competency computation (Plans 25a/25b — this only renders)
- Actual practice-taking runtime (links to Sprint 2 assessment flow)

## 3. Prerequisites / Dependencies

- Plan 25a + 25b (competency scores, insights, recommendations)
- Plan 24 (drive participation history)
- Plan 19 (Sprint 2 — Recharts, chart components)

## 4. Technical Approach

This is a **rendering + UX plan** — the hard analytics are done in 25a/25b. It composes their outputs into a motivating, actionable student experience.

Design principles for a student audience:
- **Lead with strengths, then growth areas** — framing matters; "here's where you're strong, here's where to grow" not "here's everything wrong."
- **Concrete next actions** — every weakness links to practice, so the dashboard drives behavior, not just awareness.
- **Show progress** — trends celebrate improvement, sustaining motivation.
- **Cohort comparison is opt-in and gentle** — "top 30% in Aptitude" motivates; raw rank can demoralize.

The centerpiece is a section competency overview (radar or bar) with color-coded tiers, drilling into skills, with a prioritized "focus areas" panel driven by 25b recommendations.

## 5. Implementation Steps

1. Create `services/dashboards/student-dashboard.ts`:
   - `getStudentOverview(userId)` — aggregate: overall readiness, # drives, strong/weak counts, top priority
   - Composes 25a (scores) + 25b (insights, recommendations) + 24 (drive history)
2. Rebuild student dashboard `/app/(protected)/dashboard/page.tsx` (student role branch):
   - **Readiness header**: overall competency snapshot, drives participated, improvement indicator
   - **Focus areas panel** (prominent): top 3 priorities from 25b with "Practice now" links
   - **Section overview**: competency across all sections (radar/bar, tier-colored)
   - **Recent drive performance**: last drive results, round-by-round
   - **Strengths highlight**: what they're good at (motivation)
3. Create `/app/(protected)/my-competency/page.tsx` — the deep analytics view:
   - Full section breakdown with scores + tiers + trends
   - Expandable per-section → skill-level breakdown
   - Trend chart per section (over time / across drives)
   - Cohort comparison toggle ("Compare with my batch")
4. Create `/app/(protected)/my-competency/[sectionId]/page.tsx` — section deep-dive:
   - All skills in this section, scored
   - Which questions/topics they missed (from drive history)
   - Targeted recommendations for this section
   - Practice question sets
5. Create `/app/(protected)/my-competency/recommendations/page.tsx`:
   - Full prioritized recommendation list (25b)
   - Each → practice question set (links to Sprint 2 assessment/practice flow)
6. Create student drive history `/app/(protected)/my-drives/history/page.tsx` (extends Plan 24 view):
   - All drives with outcomes
   - Per-drive competency snapshot (how each drive shifted their profile)
7. Create components:
   - `components/dashboards/readiness-header.tsx`
   - `components/dashboards/focus-areas-panel.tsx`
   - `components/competency/section-radar.tsx` (Recharts radar)
   - `components/competency/section-bar-chart.tsx`
   - `components/competency/skill-breakdown.tsx`
   - `components/competency/competency-trend-chart.tsx`
   - `components/competency/cohort-comparison.tsx` (gentle framing)
   - `components/competency/practice-cta.tsx`
8. Wire "Practice now" CTAs → Sprint 2 assessment flow (create a practice assessment from recommended skill questions, or link existing practice sets)
9. Ensure all reads are self-scoped (student sees only own data)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `services/dashboards/student-dashboard.ts` | Student aggregation |
| Modify | `app/(protected)/dashboard/page.tsx` | Student dashboard branch |
| Create | `app/(protected)/my-competency/page.tsx` | Deep analytics |
| Create | `app/(protected)/my-competency/[sectionId]/page.tsx` | Section deep-dive |
| Create | `app/(protected)/my-competency/recommendations/page.tsx` | Recommendations |
| Create | `app/(protected)/my-drives/history/page.tsx` | Drive history |
| Create | `components/dashboards/*.tsx`, `components/competency/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Student dashboard loads with readiness snapshot
- [ ] Focus areas show top 3 priorities from 25b
- [ ] Section radar/bar shows all sections, tier-colored correctly
- [ ] Drill into section → skills breakdown shown
- [ ] Trend chart shows improvement across multiple drives
- [ ] Weak sections visually distinct from strong (color tiers)
- [ ] "Practice now" → launches relevant practice questions
- [ ] Cohort comparison toggle works, framing is gentle (percentile not raw rank)
- [ ] Recommendations page lists all priorities with practice links
- [ ] Drive history shows per-drive outcomes + competency shift
- [ ] Student with no data yet → helpful empty state ("take a drive to see insights")
- [ ] Student sees ONLY own data (no leakage)
- [ ] Mobile responsive
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: student dashboard composition, strength-first framing, practice CTA wiring, self-scoping
- Add to `docs/project-context.md`: Phase 1 Plan 26 completed — **student dashboard live (Dashboard #1 of 3)**

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (charts, drill-downs, framing, empty states)
- Documentation updates: ~5 minutes

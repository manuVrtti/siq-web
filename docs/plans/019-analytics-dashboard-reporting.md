# Plan 019 — Analytics Dashboard & Reporting

## 1. Objective

Build analytics dashboards that give administrators and recruiters actionable insight into assessment performance, candidate outcomes, question quality, and platform usage.

## 2. Scope

- Assessment-level analytics (score distribution, completion, pass rate, time analysis)
- Question-level analytics (difficulty index, discrimination, most-missed)
- Candidate performance analytics (per-batch, per-skill)
- Org-level dashboard (SuperAdmin platform view)
- Charts and visualizations
- Aggregation queries with caching

### Out of Scope

- Data export (Plan 20)
- Predictive/ML analytics (future)
- Real-time streaming dashboards (batch aggregation is sufficient)
- Custom report builder (future)

## 3. Prerequisites / Dependencies

- Plan 16 complete (results data to analyze)
- Plan 18 (proctoring flags feed integrity metrics — optional)
- Plan 08 (UI foundation)

## 4. Technical Approach

Analytics are computed from existing Result, QuestionResult, and ExamAttempt data via Prisma aggregation queries. For expensive aggregations, results are cached (in-memory with TTL, or a lightweight `AnalyticsSnapshot` table refreshed periodically).

Charts use Recharts (React-native charting). Key metrics:
- **Assessment**: score histogram, pass rate, avg completion time, question count answered
- **Question**: p-value (difficulty index = % correct), point-biserial (discrimination), attempt distribution
- **Candidate/Batch**: performance trends, skill-tag breakdown

Role-scoped: admins see their org, SuperAdmin sees platform-wide.

## 5. Implementation Steps

1. (Optional) Add caching table:
   ```prisma
   model AnalyticsSnapshot {
     id          String   @id @default(cuid())
     scope       String   // "assessment", "org", "platform"
     scopeId     String
     metrics     Json
     computedAt  DateTime @default(now())

     @@unique([scope, scopeId])
     @@index([scope])
   }
   ```
2. Run migration (if using cache): `npx prisma migrate dev --name analytics_cache`
3. Create `services/analytics/assessment-analytics.ts`:
   - `getScoreDistribution(assessmentId)` — histogram buckets
   - `getPassRate(assessmentId)`
   - `getCompletionStats(assessmentId)` — started vs submitted vs expired
   - `getTimeAnalysis(assessmentId)` — avg/median completion time
   - `getSectionPerformance(assessmentId)` — avg score per section
4. Create `services/analytics/question-analytics.ts`:
   - `getDifficultyIndex(questionId)` — % who answered correctly (p-value)
   - `getDiscrimination(questionId)` — correlation between question correctness and total score
   - `getMostMissed(assessmentId)` — questions with lowest correct rate
   - `getOptionDistribution(questionId)` — which options chosen (for MCQ diagnostics)
5. Create `services/analytics/candidate-analytics.ts`:
   - `getBatchPerformance(batchId)` — aggregate scores across batch
   - `getSkillBreakdown(userId)` — performance by tag/skill
   - `getCandidateTrend(userId)` — scores over time across assessments
6. Create `services/analytics/org-analytics.ts`:
   - `getOrgOverview(orgId)` — total assessments, candidates, avg scores
   - `getPlatformOverview()` — SuperAdmin: orgs, users, assessments, activity
7. Install Recharts: `npm install recharts`
8. Create API routes (role-scoped):
   - `/app/api/analytics/assessments/[id]/route.ts`
   - `/app/api/analytics/questions/[id]/route.ts`
   - `/app/api/analytics/batches/[id]/route.ts`
   - `/app/api/analytics/org/route.ts`
   - `/app/api/analytics/platform/route.ts` (SuperAdmin only)
9. Create dashboard pages:
   - `/app/(protected)/analytics/page.tsx` — org overview dashboard (default)
   - `/app/(protected)/assessments/[id]/analytics/page.tsx` — per-assessment deep dive
   - `/app/(protected)/admin/analytics/page.tsx` — platform-wide (SuperAdmin)
10. Create chart components:
    - `components/analytics/score-histogram.tsx`
    - `components/analytics/pass-rate-gauge.tsx`
    - `components/analytics/completion-funnel.tsx`
    - `components/analytics/question-difficulty-chart.tsx`
    - `components/analytics/skill-radar.tsx`
    - `components/analytics/trend-line.tsx`
    - `components/analytics/stat-card.tsx` (KPI tiles)
11. Add "Analytics" nav item (role-gated) to sidebar (Plan 08 config)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | AnalyticsSnapshot (optional) |
| Create | `services/analytics/assessment-analytics.ts` | Assessment metrics |
| Create | `services/analytics/question-analytics.ts` | Question metrics |
| Create | `services/analytics/candidate-analytics.ts` | Candidate metrics |
| Create | `services/analytics/org-analytics.ts` | Org/platform metrics |
| Install | `recharts` | Charting |
| Create | `app/api/analytics/*/route.ts` | Analytics APIs |
| Create | `app/(protected)/analytics/page.tsx` | Org dashboard |
| Create | `app/(protected)/assessments/[id]/analytics/page.tsx` | Assessment analytics |
| Create | `app/(protected)/admin/analytics/page.tsx` | Platform analytics |
| Create | `components/analytics/*.tsx` | Chart components |
| Modify | `constants/navigation.ts` | Analytics nav item |

## 7. Testing / Verification

- [ ] Assessment analytics: score histogram renders with real data
- [ ] Pass rate computed correctly
- [ ] Completion funnel: invited → started → submitted counts accurate
- [ ] Time analysis: avg completion time reasonable
- [ ] Question difficulty index (p-value) correct for known data
- [ ] Most-missed questions surface correctly
- [ ] MCQ option distribution shows choice breakdown
- [ ] Batch performance aggregates correctly
- [ ] Skill radar reflects tag-based performance
- [ ] Candidate trend line shows scores over time
- [ ] Org overview KPIs accurate
- [ ] SuperAdmin platform view accessible; blocked for other roles (403)
- [ ] Recruiter sees only their org's analytics
- [ ] Charts responsive on mobile
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: analytics service structure, metric definitions (p-value, discrimination), caching approach, role scoping
- Add to `docs/project-context.md`: Plan 19 completed, analytics dashboards live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~20 minutes (verify metrics against known data)
- Documentation updates: ~5 minutes

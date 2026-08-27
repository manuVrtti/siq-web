# Plan 026 — Weak-Topic Detection & Recommendations

## 1. Objective

Turn the raw competency scores (Plan 25a) into **actionable insight**: automatically identify each student's strong and weak sections/skills, classify severity, detect improvement or decline over time, and generate targeted practice recommendations. This is what makes the diagnostic *useful* rather than just informative.

## 2. Scope

- Strength/weakness classification (absolute + relative-to-cohort)
- Severity tiers (critical gap / needs work / on track / strong)
- Trend detection (improving / declining / stable per dimension)
- Recommendation generation (weak skills → practice suggestions)
- Priority ranking (what to fix first)
- Student-facing insight objects (feeds Plan 26 student dashboard)
- HOD/placement-head aggregate insight (feeds Plans 27–28)

### Out of Scope

- The dashboard UI (Plans 26–28 render these insights)
- AI-generated study plans (Phase 2)
- Recommending specific external content/courses (Phase 2 — we recommend internal question sets + topics)

## 3. Prerequisites / Dependencies

- Plan 25a (competency scores + cohort baselines — the input)
- Plan 21 (taxonomy — for recommendation targeting)
- Sprint 2 Plan 11 (question bank — practice recommendations point to questions)

## 4. Technical Approach

Plan 25a answers "what are the scores?"; 25b answers "so what, and what now?"

**Classification** combines two lenses:
- *Absolute*: score below a threshold (e.g., <50% = weak) — objective competence.
- *Relative*: below the cohort's bottom quartile (p25 from 25a baselines) — competitive standing.
A skill flagged on both is a higher-priority gap than one flagged on only one.

**Severity tiers** map scores to plain-language buckets students and HODs understand: Critical Gap / Needs Work / On Track / Strong.

**Trends** compare recent snapshots vs earlier ones (25a stores per-assessment snapshots with timestamps) to detect trajectory — a student at 55% and rising is different from one at 55% and falling.

**Recommendations** are deterministic and rule-based (no ML): for each weak skill, surface (a) the topic to study, (b) available practice questions tagged with that skill (from the bank), (c) priority based on severity + how foundational the section is. This keeps Phase 1 explainable and trustworthy.

Insights are computed and cached as structured objects so dashboards render instantly rather than recomputing.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum CompetencyTier {
     CRITICAL_GAP
     NEEDS_WORK
     ON_TRACK
     STRONG
   }

   enum CompetencyTrend {
     IMPROVING
     STABLE
     DECLINING
     INSUFFICIENT_DATA
   }

   model CompetencyInsight {
     id            String          @id @default(cuid())
     userId        String
     dimensionType String          // "SECTION" | "SKILL"
     dimensionId   String
     dimensionName String          // denormalized for fast display
     sectionId     String?         // parent section for skills
     score         Float           // from 25a cumulative
     tier          CompetencyTier
     belowAbsolute Boolean         // below absolute threshold
     belowCohort   Boolean         // below cohort p25
     trend         CompetencyTrend
     priority      Int             // 0 = highest
     computedAt    DateTime        @default(now())

     user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([userId, dimensionType, dimensionId])
     @@index([userId, tier])
     @@index([userId, priority])
   }

   model PracticeRecommendation {
     id            String    @id @default(cuid())
     userId        String
     skillId       String
     skillName     String
     reason        String    // "Critical gap in Dynamic Programming"
     priority      Int
     questionCount Int       // available practice questions for this skill
     createdAt     DateTime  @default(now())

     user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId, priority])
   }
   ```
2. Run migration: `npx prisma migrate dev --name competency_insights`
3. Create `constants/competency-thresholds.ts`:
   - Tier boundaries (e.g., <40 CRITICAL_GAP, 40–60 NEEDS_WORK, 60–80 ON_TRACK, >80 STRONG) — tunable
   - Trend sensitivity (min delta + min snapshots for a call)
   - Section foundational-ness weights (DSA more foundational than a niche topic → higher recommendation priority)
4. Create `services/competency/classification.ts`:
   - `classifyTier(score)` — absolute tier
   - `evaluateDimension(score, baseline)` — belowAbsolute + belowCohort flags
   - `detectTrend(userId, dimensionType, dimensionId)` — compare recent vs prior snapshots (25a)
5. Create `services/competency/insights.ts` — the analyzer:
   - `generateInsights(userId)`:
     - Pull cumulative section + skill competencies (25a)
     - Pull cohort baselines (25a)
     - For each dimension: classify tier, flag absolute/cohort, detect trend
     - Compute priority (severity × foundational weight × cohort gap)
     - Upsert CompetencyInsight rows
   - `getStrengths(userId)` — STRONG / ON_TRACK dimensions
   - `getWeaknesses(userId)` — NEEDS_WORK / CRITICAL_GAP, priority-sorted
   - `getTopPriorities(userId, n)` — the n things to fix first
6. Create `services/competency/recommendations.ts`:
   - `generateRecommendations(userId)`:
     - For each weak skill, count available practice questions (bank, Plan 11, tagged with skill)
     - Build PracticeRecommendation with reason + priority
   - `getRecommendations(userId)` — priority-ordered
   - `getPracticeQuestions(userId, skillId)` — actual questions to practice (respects not-yet-seen where possible)
7. Create aggregate insight services (for HOD/placement-head dashboards):
   - `getDepartmentWeakSpots(departmentId, batchYear?)` — most common weak sections/skills across the cohort (which topics is the *department* weak in)
   - `getCollegeWeakSpots(collegeOrgId, batchYear?)` — same, college-wide
   - `getStudentsNeedingAttention(departmentId)` — students with most critical gaps (HOD triage list)
8. Hook: after 25a recompute (grading finalization) → regenerate insights + recommendations for that student (debounced)
9. Create API routes:
   - `/app/api/competency/students/[userId]/insights/route.ts` — GET
   - `/app/api/competency/students/[userId]/strengths/route.ts` — GET
   - `/app/api/competency/students/[userId]/weaknesses/route.ts` — GET
   - `/app/api/competency/students/[userId]/recommendations/route.ts` — GET
   - `/app/api/competency/departments/[id]/weak-spots/route.ts` — GET (HOD/placement head)
   - `/app/api/competency/departments/[id]/attention-list/route.ts` — GET (HOD triage)
   - `/app/api/competency/college/weak-spots/route.ts` — GET (placement head)
10. Enforce department scoping (Plan 22) on all aggregate + per-student reads
11. Create shared insight components (used by dashboards in 26–28):
    - `components/competency/strength-weakness-list.tsx`
    - `components/competency/tier-badge.tsx`
    - `components/competency/trend-indicator.tsx`
    - `components/competency/recommendation-card.tsx`
    - `components/competency/priority-list.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | CompetencyInsight, PracticeRecommendation |
| Create | `constants/competency-thresholds.ts` | Tier + trend + priority config |
| Create | `services/competency/classification.ts` | Tier + flag + trend logic |
| Create | `services/competency/insights.ts` | Insight analyzer |
| Create | `services/competency/recommendations.ts` | Recommendation generator |
| Create | `services/competency/aggregate-insights.ts` | Dept/college weak spots + triage |
| Modify | `services/competency/rollup.ts` (25a) | Trigger insight regen |
| Create | `app/api/competency/students/[userId]/*/route.ts` | Student insight APIs |
| Create | `app/api/competency/departments/[id]/*/route.ts` | Aggregate APIs |
| Create | `app/api/competency/college/weak-spots/route.ts` | College aggregate |
| Create | `components/competency/*.tsx` | Shared insight UI |

## 7. Testing / Verification

- [ ] Student with 35% DSA → CRITICAL_GAP tier
- [ ] Student with 72% Aptitude → ON_TRACK tier
- [ ] Skill below both absolute threshold AND cohort p25 → higher priority than one below only absolute
- [ ] Trend: 3 rising snapshots → IMPROVING
- [ ] Trend: 3 falling snapshots → DECLINING
- [ ] Single snapshot → INSUFFICIENT_DATA
- [ ] Top priorities correctly ranked (severity × foundational × cohort gap)
- [ ] Recommendations generated for weak skills with practice question counts
- [ ] Practice questions returned are tagged with the target skill
- [ ] Weak skill with 0 available questions → recommendation notes gap
- [ ] Department weak spots: correct most-common-weakness across cohort
- [ ] Attention list: students with most critical gaps surface first
- [ ] Insights regenerate after new assessment graded
- [ ] Student sees own insights; HOD sees dept; scoping enforced
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: classification (absolute + relative), severity tiers, trend detection, rule-based recommendations, aggregate weak spots, priority formula
- Add to `CLAUDE.md`: "Recommendations are deterministic and explainable in Phase 1 — no ML, so every insight can be justified to a student or HOD"
- Add to `docs/project-context.md`: Phase 1 Plan 25b completed — **diagnostic engine complete**: scores → insights → recommendations

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~35 minutes (classification edge cases, trends, recommendation correctness)
- Documentation updates: ~10 minutes

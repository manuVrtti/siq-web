# Plan 025 — Competency Scoring & Rollup Engine

## 1. Objective

Build the engine that converts raw question-level results into structured **per-student competency scores across sections and skills** — the diagnostic core that makes SelectIQ a strength/weakness analyzer, not just a test-scorer. This plan computes and stores the rollups; Plan 25b turns them into weak-topic detection and recommendations.

## 2. Scope

- Per-question outcome extraction tagged by section + skill (from Plan 21 tags)
- Rollup computation: section-level and skill-level competency scores per student
- Aggregation across multiple assessments/drives (a student's cumulative profile)
- Normalization (accuracy %, weighted by difficulty and attempts)
- Competency snapshot storage (point-in-time + cumulative)
- Recompute triggers (on grading completion)
- Cohort baseline computation (for relative comparison in 25b/dashboards)

### Out of Scope

- Weak-topic *detection* logic and recommendations (Plan 25b)
- Dashboards/visualization (Plans 26–28)
- Predictive/ML scoring (Phase 2)

## 3. Prerequisites / Dependencies

- Plan 21 (section + skill tags on questions — the axes)
- Plan 24 (mock drive results — a key data source)
- Sprint 2 Plans 15, 16 (exam answers + grading — the raw material)

## 4. Technical Approach

Every graded `QuestionResult` (Sprint 2 Plan 16) already knows: which question, correct/incorrect, marks. Plan 21 gives each question its section + skills. Joining these lets us attribute each answer to competency dimensions.

The rollup computes, per student:
- **Section competency** = accuracy on that section's questions (weighted by difficulty), e.g., "DSA: 68%"
- **Skill competency** = accuracy on that skill's questions, e.g., "Dynamic Programming: 40%"

Scores aggregate two ways:
1. **Per-assessment/drive snapshot** — how they did in *this* event (enables trend analysis)
2. **Cumulative profile** — rolling competency across everything they've attempted (the "current state" the student/HOD sees)

Weighting: harder questions and more attempts carry more signal. A student who nails HARD graph questions scores higher on "Graphs" than one who only cleared EASY ones. We store both raw counts and normalized scores so 25b can apply thresholds and the dashboards can show either.

Cohort baselines (department/batch averages per section/skill) are computed here too, so "weak" can mean both *absolute* (below 50%) and *relative* (bottom quartile of cohort).

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum CompetencyScope {
     ASSESSMENT     // single assessment snapshot
     DRIVE          // aggregated across a drive
     CUMULATIVE     // rolling all-time profile
   }

   model SectionCompetency {
     id            String          @id @default(cuid())
     userId        String
     sectionId     String
     scope         CompetencyScope
     scopeRefId    String?         // assessmentId / driveId / null for cumulative
     questionsAttempted Int
     questionsCorrect   Int
     rawAccuracy   Float           // correct/attempted
     weightedScore Float           // difficulty-weighted
     marksEarned   Float
     marksPossible Float
     computedAt    DateTime        @default(now())

     user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([userId, sectionId, scope, scopeRefId])
     @@index([userId, scope])
     @@index([sectionId])
   }

   model SkillCompetency {
     id            String          @id @default(cuid())
     userId        String
     skillId       String
     scope         CompetencyScope
     scopeRefId    String?
     questionsAttempted Int
     questionsCorrect   Int
     rawAccuracy   Float
     weightedScore Float
     computedAt    DateTime        @default(now())

     user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([userId, skillId, scope, scopeRefId])
     @@index([userId, scope])
     @@index([skillId])
   }

   model CohortBaseline {
     id            String    @id @default(cuid())
     collegeOrgId  String
     departmentId  String?   // null = whole college
     batchYear     Int?
     dimensionType String    // "SECTION" | "SKILL"
     dimensionId   String    // sectionId or skillId
     avgAccuracy   Float
     medianAccuracy Float
     p25Accuracy   Float     // bottom-quartile threshold
     p75Accuracy   Float
     sampleSize    Int
     computedAt    DateTime  @default(now())

     @@unique([collegeOrgId, departmentId, batchYear, dimensionType, dimensionId])
     @@index([collegeOrgId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name competency_rollups`
3. Create `lib/competency/weighting.ts`:
   - Difficulty weights (EASY=1, MEDIUM=1.5, HARD=2 — tunable constants)
   - `weightedScore(results)` — difficulty-weighted accuracy
   - Handles negative marking, partial credit consistently with Sprint 2 grading
4. Create `services/competency/rollup.ts` — the engine:
   - `computeAssessmentCompetency(userId, assessmentId)`:
     - Pull QuestionResults for this student+assessment
     - Join question → section + skills (Plan 21)
     - Group by section → SectionCompetency (scope=ASSESSMENT)
     - Group by skill → SkillCompetency (scope=ASSESSMENT)
     - Upsert snapshots
   - `computeDriveCompetency(userId, driveId)` — aggregate across the drive's rounds
   - `recomputeCumulative(userId)` — roll up ALL of the student's attempts into CUMULATIVE profile
   - `recomputeForStudent(userId, assessmentId)` — orchestrates: assessment snapshot → refresh cumulative
5. Create `services/competency/cohort-baseline.ts`:
   - `computeBaselines(collegeOrgId, departmentId?, batchYear?)` — avg/median/quartiles per section + skill across the cohort's cumulative competencies
   - Run as a batch job (after drives complete, or scheduled)
6. Hook into Sprint 2 grading (Plan 16):
   - On result finalization → call `recomputeForStudent(userId, assessmentId)`
   - Debounce/batch if a drive round grades many at once
7. Create read services (consumed by 25b + dashboards):
   - `getStudentCompetencyProfile(userId, scope, scopeRefId?)` — sections + skills with scores
   - `getSectionBreakdown(userId)` — cumulative section scores, sorted
   - `getSkillBreakdown(userId, sectionId?)` — cumulative skill scores
   - `getCompetencyVsCohort(userId, departmentId, batchYear)` — student score vs baseline per dimension
8. Create API routes (internal-facing; dashboards call these):
   - `/app/api/competency/students/[userId]/profile/route.ts` — GET (scoped: student self, HOD for dept, placement head)
   - `/app/api/competency/students/[userId]/sections/route.ts` — GET
   - `/app/api/competency/students/[userId]/skills/route.ts` — GET
   - `/app/api/competency/recompute/route.ts` — POST (admin manual recompute)
   - `/app/api/competency/baselines/route.ts` — POST (compute), GET
9. Add access control: competency reads respect department scoping (Plan 22 `scopeStudentsQuery`) — HOD only for their dept, student only self
10. Create a recompute admin utility page (placement cell): trigger full recompute + baseline refresh

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | SectionCompetency, SkillCompetency, CohortBaseline |
| Create | `lib/competency/weighting.ts` | Difficulty weighting |
| Create | `services/competency/rollup.ts` | Core rollup engine |
| Create | `services/competency/cohort-baseline.ts` | Baseline computation |
| Modify | `services/grading.ts` (Sprint 2) | Trigger recompute on grading |
| Create | `services/competency/read.ts` | Profile read services |
| Create | `app/api/competency/*/route.ts` | Competency APIs |

## 7. Testing / Verification

- [ ] Student completes tagged assessment → section competencies computed
- [ ] Skill competencies computed for each tagged skill
- [ ] Difficulty weighting: acing HARD questions > acing EASY on same skill
- [ ] Raw accuracy = correct/attempted (verify against known data)
- [ ] Cumulative profile aggregates across 2+ assessments correctly
- [ ] Drive competency aggregates across drive rounds
- [ ] Cohort baseline: avg/median/quartiles correct for a known cohort
- [ ] Recompute triggered automatically on grading finalization
- [ ] `getCompetencyVsCohort` correctly flags student below p25
- [ ] Student can read own profile; not others'
- [ ] HOD reads dept students' profiles; not other depts (scoping enforced)
- [ ] Placement head reads all college profiles
- [ ] Manual recompute produces identical results to incremental
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: competency rollup engine, section vs skill scoring, difficulty weighting, scope levels (assessment/drive/cumulative), cohort baselines, grading hook
- Add to `CLAUDE.md`: "Competency reads MUST use department scoping — a student's profile is sensitive data"
- Add to `docs/project-context.md`: Phase 1 Plan 25a completed, competency scoring engine live — **the diagnostic foundation**

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~35 minutes (correctness is critical — verify math against hand-computed cases)
- Documentation updates: ~10 minutes

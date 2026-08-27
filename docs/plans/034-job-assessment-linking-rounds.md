# Plan 034 — Job–Assessment Linking & Hiring Rounds

## 1. Objective

Connect the recruitment side (jobs) to the assessment engine (Sprint 2) by defining multi-round hiring workflows, where each round can be an assessment, interview, or manual screen.

## 2. Scope

- Hiring workflow model (ordered rounds per job)
- Round types: assessment, interview, group discussion, manual screening
- Linking existing assessments (Sprint 2) to job rounds
- Round configuration (auto-advance rules, cutoffs)
- Recruiter workflow builder UI
- Foundation for the application pipeline (Plan 24)

### Out of Scope

- Applications flowing through rounds (Plan 24)
- Interview scheduling internals (Plan 26)
- Offer generation (Plan 27)

## 3. Prerequisites / Dependencies

- Plan 22 complete (jobs)
- Plan 12 complete (assessments to link)
- Plan 16 (results feed round cutoffs)

## 4. Technical Approach

Each `JobPosting` has an ordered set of `HiringRound`s forming the selection funnel (e.g., Round 1: Online Assessment → Round 2: Technical Interview → Round 3: HR Interview). A round of type ASSESSMENT references an existing `Assessment` from Sprint 2, reusing all its infrastructure (proctoring, grading, SEB).

Rounds can define advancement rules: a cutoff score (for assessment rounds) or manual advancement (for interviews). This model is the skeleton; Plan 24 moves candidates through it.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum RoundType {
     ASSESSMENT
     INTERVIEW
     GROUP_DISCUSSION
     MANUAL_SCREEN
   }

   enum AdvancementRule {
     AUTO_CUTOFF     // advance if score >= cutoff
     MANUAL          // recruiter decides
     ALL_ADVANCE     // everyone proceeds
   }

   model HiringRound {
     id            String    @id @default(cuid())
     jobId         String
     name          String
     type          RoundType
     order         Int
     assessmentId  String?   // for ASSESSMENT type
     advancementRule AdvancementRule @default(MANUAL)
     cutoffScore   Float?
     scheduledAt   DateTime?
     durationMinutes Int?
     instructions  String?   @db.Text
     createdAt     DateTime  @default(now())

     job           JobPosting  @relation(fields: [jobId], references: [id], onDelete: Cascade)
     assessment    Assessment? @relation(fields: [assessmentId], references: [id])

     @@index([jobId])
   }
   ```
2. Add reverse relation on Assessment: `hiringRounds HiringRound[]`
3. Run migration: `npx prisma migrate dev --name hiring_rounds`
4. Create `services/hiring-rounds.ts`:
   - `addRound(jobId, data)` — append round
   - `updateRound(id, data)`
   - `reorderRounds(jobId, orderedIds)`
   - `deleteRound(id)`
   - `linkAssessment(roundId, assessmentId)` — validates assessment belongs to company's org
   - `getJobWorkflow(jobId)` — ordered rounds with linked assessment info
   - `validateWorkflow(jobId)` — ensure workflow is coherent before job publish
5. Update `services/jobs.ts` publish validation:
   - Job with ASSESSMENT round must have a linked, published assessment
6. Create API routes:
   - `/app/api/jobs/[id]/rounds/route.ts` — GET, POST
   - `/app/api/jobs/[id]/rounds/[roundId]/route.ts` — PATCH, DELETE
   - `/app/api/jobs/[id]/rounds/reorder/route.ts` — POST
7. Create `/app/(protected)/jobs/[id]/workflow/page.tsx`:
   - Visual round builder (ordered list/timeline)
   - Add round → select type
   - Assessment round → picker to link existing assessment (or "Create new" → deep-link to Plan 12 builder)
   - Configure advancement rule + cutoff per round
   - Drag to reorder
   - Workflow validation indicators
8. Create components:
    - `components/hiring/workflow-builder.tsx`
    - `components/hiring/round-editor.tsx`
    - `components/hiring/round-timeline.tsx`
    - `components/hiring/assessment-linker.tsx`
9. Update job detail (student view, Plan 22) to show the selection process overview (round names + types, without internal cutoffs)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | HiringRound |
| Create | `services/hiring-rounds.ts` | Round logic |
| Modify | `services/jobs.ts` | Publish validation with rounds |
| Create | `app/api/jobs/[id]/rounds/*/route.ts` | Round APIs |
| Create | `app/(protected)/jobs/[id]/workflow/page.tsx` | Workflow builder |
| Create | `components/hiring/*.tsx` | Workflow components |
| Modify | `app/(protected)/opportunities/[id]/page.tsx` | Show process overview |

## 7. Testing / Verification

- [ ] Add assessment round to job → linked to existing assessment
- [ ] Add interview round → manual advancement
- [ ] Reorder rounds → order persists
- [ ] Assessment round with cutoff → cutoff saved
- [ ] Link assessment from another company's org → blocked
- [ ] Publish job with assessment round but no linked assessment → blocked
- [ ] Publish job with complete workflow → succeeds
- [ ] Student job detail shows round overview (no internal cutoffs)
- [ ] Delete round → removed, order re-normalized
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: hiring workflow model, round types, assessment linking, advancement rules
- Add to `docs/project-context.md`: Plan 23 completed, jobs connected to assessment engine

## 9. Estimated Effort

- Claude Code execution: ~50 minutes
- Manual testing: ~15 minutes
- Documentation updates: ~5 minutes

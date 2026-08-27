# Plan 035 — Application Pipeline & Candidate Tracking

## 1. Objective

Build the application system where students apply to jobs and move through the hiring rounds, giving recruiters a pipeline (ATS-style) view to track, filter, and advance candidates.

## 2. Scope

- Application model (student applies to job)
- Eligibility enforcement at application time
- Application state machine (through hiring rounds)
- Auto-advancement based on assessment cutoffs (Plan 23 rules)
- Recruiter pipeline/kanban view
- Bulk candidate actions (advance, reject, shortlist)
- Student application tracking view

### Out of Scope

- Interview scheduling (Plan 26)
- Offer letters (Plan 27)
- Notifications (Sprint 4 — basic status change here, rich notifications later)

## 3. Prerequisites / Dependencies

- Plan 22 complete (jobs + student profiles)
- Plan 23 complete (hiring rounds)
- Plan 16 (assessment results drive auto-advancement)
- Plan 13 (assessment assignment — reused when a candidate enters an assessment round)

## 4. Technical Approach

An `Application` links a student to a job and tracks their position in the workflow via `currentRoundId` and a status. Each round the candidate reaches produces an `ApplicationRoundProgress` record capturing the outcome (pending, passed, failed, advanced).

For ASSESSMENT rounds, the system auto-creates an assessment assignment (Plan 13) for the candidate; when they submit and it's graded (Plan 16), auto-advancement rules (Plan 23) evaluate the cutoff and move them forward or reject.

For manual rounds (interviews), recruiters advance candidates explicitly. The recruiter sees a kanban board: columns are rounds, cards are candidates.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum ApplicationStatus {
     APPLIED
     IN_PROGRESS
     SELECTED
     REJECTED
     WITHDRAWN
     ON_HOLD
   }

   enum RoundOutcome {
     PENDING
     PASSED
     FAILED
     ADVANCED
     SKIPPED
   }

   model Application {
     id            String            @id @default(cuid())
     jobId         String
     userId        String
     status        ApplicationStatus @default(APPLIED)
     currentRoundId String?
     appliedAt     DateTime          @default(now())
     updatedAt     DateTime          @updatedAt

     job           JobPosting  @relation(fields: [jobId], references: [id], onDelete: Cascade)
     user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
     progress      ApplicationRoundProgress[]

     @@unique([jobId, userId])
     @@index([jobId])
     @@index([userId])
     @@index([status])
   }

   model ApplicationRoundProgress {
     id            String        @id @default(cuid())
     applicationId String
     roundId       String
     outcome       RoundOutcome  @default(PENDING)
     assignmentId  String?       // link to AssessmentAssignment for assessment rounds
     score         Float?
     notes         String?       @db.Text
     decidedById   String?
     enteredAt     DateTime      @default(now())
     decidedAt     DateTime?

     application   Application   @relation(fields: [applicationId], references: [id], onDelete: Cascade)

     @@index([applicationId])
     @@index([roundId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name application_pipeline`
3. Create `services/applications.ts`:
   - `apply(jobId, userId)` — checks eligibility (Plan 22), creates Application, enters first round
   - `enterRound(applicationId, roundId)` — creates progress; for ASSESSMENT type, auto-creates assignment (Plan 13)
   - `recordRoundOutcome(applicationId, roundId, outcome, meta)` — manual or auto
   - `advanceCandidate(applicationId)` — move to next round or mark SELECTED if last
   - `rejectCandidate(applicationId, reason)`
   - `bulkAction(applicationIds, action)` — advance/reject/shortlist
   - `getPipeline(jobId)` — all applications grouped by current round
   - `listStudentApplications(userId)` — student's applications + statuses
4. Create `services/auto-advancement.ts`:
   - Hook called after grading (Plan 16): if the graded assessment is tied to an application's assessment round with AUTO_CUTOFF rule, compare score → pass/fail → advance/reject
   - Wire into Plan 16's `recomputeResult` / grading finalization
5. Create API routes:
   - `/app/api/jobs/[id]/apply/route.ts` — POST (student applies)
   - `/app/api/jobs/[id]/pipeline/route.ts` — GET (recruiter pipeline)
   - `/app/api/applications/[id]/advance/route.ts` — POST
   - `/app/api/applications/[id]/reject/route.ts` — POST
   - `/app/api/applications/bulk/route.ts` — POST (bulk actions)
   - `/app/api/students/me/applications/route.ts` — GET
6. Wire "Apply" button on student job detail (Plan 22) → apply flow with confirmation
7. Create `/app/(protected)/jobs/[id]/pipeline/page.tsx`:
   - Kanban board: columns = rounds, cards = candidates
   - Card shows: name, branch, CGPA, score (if assessment round), resume link
   - Drag card to advance, or use per-card actions
   - Filters (branch, score range, status)
   - Bulk select → advance/reject
   - Round-level stats (count per round, pass rate)
8. Create `/app/(protected)/my-applications/page.tsx`:
   - Student's applications with current stage, status, next action
   - If pending assessment round → link to take assessment
9. Create components:
    - `components/pipeline/kanban-board.tsx`
    - `components/pipeline/candidate-card.tsx`
    - `components/pipeline/bulk-actions-bar.tsx`
    - `components/applications/application-status-tracker.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Application, ApplicationRoundProgress |
| Create | `services/applications.ts` | Application logic |
| Create | `services/auto-advancement.ts` | Cutoff-based advancement |
| Modify | `services/grading.ts` | Trigger auto-advancement |
| Create | `app/api/jobs/[id]/apply/route.ts` | Apply |
| Create | `app/api/jobs/[id]/pipeline/route.ts` | Pipeline |
| Create | `app/api/applications/*/route.ts` | Application actions |
| Create | `app/api/students/me/applications/route.ts` | Student applications |
| Modify | `app/(protected)/opportunities/[id]/page.tsx` | Wire Apply |
| Create | `app/(protected)/jobs/[id]/pipeline/page.tsx` | Recruiter pipeline |
| Create | `app/(protected)/my-applications/page.tsx` | Student tracking |
| Create | `components/pipeline/*.tsx` | Pipeline components |
| Create | `components/applications/*.tsx` | Application components |

## 7. Testing / Verification

- [ ] Eligible student applies → Application created, enters round 1
- [ ] Ineligible student → application blocked with reason
- [ ] Duplicate application → prevented
- [ ] Assessment round → assignment auto-created, student can take it
- [ ] Submit assessment with AUTO_CUTOFF → auto-advances if above cutoff
- [ ] Submit below cutoff → auto-rejected
- [ ] Manual round → recruiter advances candidate explicitly
- [ ] Kanban shows candidates in correct round columns
- [ ] Drag candidate to next round → advances
- [ ] Bulk advance 5 candidates → all move forward
- [ ] Reject candidate → status REJECTED, removed from active pipeline
- [ ] Candidate reaches final round + passes → SELECTED
- [ ] Student sees application status + next action
- [ ] Recruiter can't see another company's pipeline
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: application state machine, round progress, auto-advancement hook, pipeline model
- Add to `docs/project-context.md`: Plan 24 completed, application pipeline live

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~30 minutes (full funnel, auto + manual advancement)
- Documentation updates: ~5 minutes

# Plan 016 — Grading Engine & Results

## 1. Objective

Build the grading engine that scores submitted attempts (auto-grading objective questions, code via Judge0, flagging subjective for manual review) and the results/reporting interfaces for both candidates and administrators.

## 2. Scope

- Auto-grading for MCQ, multi-select, true/false, coding
- Manual grading interface for subjective questions
- Score computation respecting scoring policy (standard / negative marking)
- Result model and per-question breakdown
- Candidate result view
- Admin results dashboard (per-assessment, per-candidate)
- Pass/fail determination

### Out of Scope

- Advanced analytics and cohort comparisons (Plan 19)
- Certificate generation (future sprint)
- Result export (Plan 20)
- Proctoring flags in results (Plan 18 integrates later)

## 3. Prerequisites / Dependencies

- Plan 15 complete (submitted attempts with answers)
- Plan 14 complete (code scoring)
- Plan 12 (scoring policy config)

## 4. Technical Approach

Grading runs on submission (triggered by `submitAttempt` from Plan 15) and produces a `Result` with per-question scoring in `QuestionResult` records.

- **Objective (MCQ/multi/TF)**: compare selected options to correct set. Multi-select can be all-or-nothing or partial (config).
- **Coding**: score already computed by Judge0 evaluation (Plan 14), pulled from `CodeSubmission`.
- **Subjective**: cannot auto-grade → flagged `PENDING_REVIEW`, graded manually by admin.

Total score = sum of question scores, with negative marking applied per policy. Result status is `GRADED` only once all subjective questions are manually scored.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum ResultStatus {
     PENDING_REVIEW   // has ungraded subjective questions
     GRADED
   }

   model Result {
     id            String        @id @default(cuid())
     attemptId     String        @unique
     assessmentId  String
     userId        String
     status        ResultStatus  @default(PENDING_REVIEW)
     totalScore    Float         @default(0)
     maxScore      Float
     percentage    Float         @default(0)
     passed        Boolean?
     gradedAt      DateTime?
     createdAt     DateTime      @default(now())

     user          User          @relation(fields: [userId], references: [id])
     questionResults QuestionResult[]

     @@index([assessmentId])
     @@index([userId])
   }

   model QuestionResult {
     id            String    @id @default(cuid())
     resultId      String
     questionId    String
     scoreAwarded  Float     @default(0)
     maxMarks      Float
     isCorrect     Boolean?
     needsReview   Boolean   @default(false)
     reviewedById  String?
     feedback      String?   @db.Text

     result        Result    @relation(fields: [resultId], references: [id], onDelete: Cascade)

     @@index([resultId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name grading_results`
3. Create `services/grading.ts`:
   - `gradeAttempt(attemptId)` — main entry, called on submit:
     - For each answer, dispatch by question type
     - Objective: `gradeObjective(question, answer)` → correct/incorrect + marks (with negative marking)
     - Coding: pull score from linked CodeSubmission
     - Subjective: create QuestionResult with `needsReview: true`, 0 score
     - Compute total, max, percentage
     - Set status: GRADED if no pending reviews, else PENDING_REVIEW
     - Compute pass/fail if passingScore set and fully graded
   - `gradeSubjective(questionResultId, score, feedback, reviewerId)` — manual grading
   - `recomputeResult(resultId)` — re-aggregate after manual grading, finalize if complete
4. Wire `gradeAttempt` into Plan 15's `submitAttempt`
5. Create API routes:
   - `/app/api/results/[id]/route.ts` — GET (full result with breakdown)
   - `/app/api/assessments/[id]/results/route.ts` — GET (all results for assessment, admin)
   - `/app/api/results/[id]/grade/route.ts` — POST (submit manual grades for subjective)
   - `/app/api/candidates/me/results/route.ts` — GET (candidate's own results)
6. Create candidate view `/app/(protected)/my-results/page.tsx`:
   - List of the student's completed assessments with scores
   - `/app/(protected)/my-results/[id]/page.tsx` — detailed breakdown (per-question, if allowed by config)
7. Create admin view `/app/(protected)/assessments/[id]/results/page.tsx`:
   - Results table: candidate, score, percentage, status, pass/fail
   - Sort/filter (by score, status)
   - Click row → candidate detail
   - Summary stats (avg, high, low, pass rate)
8. Create manual grading `/app/(protected)/assessments/[id]/results/[resultId]/grade/page.tsx`:
   - Shows subjective answers needing review
   - Score input + feedback per question
   - Submit → recomputes result
9. Create components:
   - `components/results/result-breakdown.tsx`
   - `components/results/results-table.tsx`
   - `components/results/manual-grading-panel.tsx`
   - `components/results/score-summary.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Result, QuestionResult |
| Create | `services/grading.ts` | Grading engine |
| Modify | `services/exam-session.ts` | Trigger grading on submit |
| Create | `app/api/results/[id]/route.ts` | Result detail |
| Create | `app/api/assessments/[id]/results/route.ts` | Assessment results |
| Create | `app/api/results/[id]/grade/route.ts` | Manual grading |
| Create | `app/api/candidates/me/results/route.ts` | Candidate results |
| Create | `app/(protected)/my-results/page.tsx` | Candidate results list |
| Create | `app/(protected)/my-results/[id]/page.tsx` | Candidate result detail |
| Create | `app/(protected)/assessments/[id]/results/page.tsx` | Admin results |
| Create | `app/(protected)/assessments/[id]/results/[resultId]/grade/page.tsx` | Grading UI |
| Create | `components/results/*.tsx` | Result components |

## 7. Testing / Verification

- [ ] Submit MCQ-only attempt → auto-graded immediately, status GRADED
- [ ] Correct MCQ → full marks; wrong MCQ → 0 (or negative if policy)
- [ ] Multi-select partial → scored per config (all-or-nothing or partial)
- [ ] Coding question → score pulled from Judge0 evaluation
- [ ] Subjective question → flagged PENDING_REVIEW, result not finalized
- [ ] Manual grade subjective → result recomputed, status GRADED
- [ ] Pass/fail determined when passingScore set
- [ ] Percentage computed correctly
- [ ] Negative marking policy deducts correctly
- [ ] Candidate sees own result (respects "show breakdown" config)
- [ ] Candidate cannot see others' results
- [ ] Admin sees all results for their org's assessment
- [ ] Summary stats (avg, pass rate) correct
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: grading dispatch by type, negative marking, PENDING_REVIEW workflow, result finalization
- Add to `docs/project-context.md`: Plan 16 completed, grading + results live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~25 minutes (all grading paths, manual review flow)
- Documentation updates: ~5 minutes

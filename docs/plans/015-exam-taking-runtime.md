# Plan 015 — Exam-Taking Runtime

## 1. Objective

Build the candidate-facing exam experience: entering via token link, answering questions across sections with a timer, autosaving progress, and submitting.

## 2. Scope

- Token-based exam entry and validation
- Exam session state model (in-progress attempts, saved answers)
- Question navigation (section-by-section, question palette)
- Answer autosave (all question types)
- Countdown timer with auto-submit on expiry
- Integrated code editor for coding questions (uses Plan 14)
- Submission flow with confirmation

### Out of Scope

- Secure Exam Browser enforcement (Plan 17 — link enforcement)
- Proctoring/face snapshots (Plan 18)
- Grading and results display (Plan 16)
- Offline resilience (future)

## 3. Prerequisites / Dependencies

- Plan 13 complete (assignments + tokens)
- Plan 14 complete (code execution for coding questions)
- Plan 12 complete (assessment structure)

## 4. Technical Approach

The exam runtime is a focused, distraction-minimal interface. Entry is via `/exam/{token}` which validates the assignment (not expired, not already submitted, within schedule window). On start, an `ExamAttempt` is created; answers are saved to `ExamAnswer` records as the candidate progresses (autosave debounced).

The timer is server-authoritative: `startedAt` + `durationMinutes` = hard deadline. Client shows countdown but the server rejects submissions after the deadline and auto-submits saved answers.

Shuffle (questions/options) is resolved at attempt start and stored, so the candidate sees a consistent order on refresh.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   model ExamAttempt {
     id            String    @id @default(cuid())
     assignmentId  String    @unique
     userId        String
     assessmentId  String
     startedAt     DateTime  @default(now())
     deadlineAt    DateTime
     submittedAt   DateTime?
     questionOrder Json      // resolved order (shuffle applied)
     currentSection Int      @default(0)

     user          User      @relation(fields: [userId], references: [id])
     answers       ExamAnswer[]

     @@index([userId])
   }

   model ExamAnswer {
     id                String    @id @default(cuid())
     attemptId         String
     questionId        String
     selectedOptionIds String[]  // for MCQ
     textAnswer        String?   @db.Text  // for subjective
     codeSubmissionId  String?   // link to CodeSubmission for coding
     savedAt           DateTime  @default(now())

     attempt           ExamAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)

     @@unique([attemptId, questionId])
     @@index([attemptId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name exam_runtime`
3. Create `services/exam-session.ts`:
   - `validateToken(token)` — checks assignment status, schedule, not submitted
   - `startAttempt(token)` — creates ExamAttempt, resolves shuffle, sets deadline, marks assignment STARTED
   - `getAttemptState(token)` — full exam state (questions with saved answers, time remaining)
   - `saveAnswer(attemptId, questionId, answer)` — upsert ExamAnswer
   - `submitAttempt(attemptId)` — mark submitted, assignment SUBMITTED, lock answers
   - `enforceDeadline(attemptId)` — server-side deadline check, auto-submit if past
4. Create API routes (token-gated, not the standard auth middleware since candidates use their session but access is token-scoped):
   - `/app/api/exam/[token]/route.ts` — GET (validate + state)
   - `/app/api/exam/[token]/start/route.ts` — POST (begin attempt)
   - `/app/api/exam/[token]/answer/route.ts` — POST (autosave)
   - `/app/api/exam/[token]/submit/route.ts` — POST (final submit)
5. Create `/app/exam/[token]/page.tsx` — exam entry:
   - Validate token → show assessment overview (title, duration, question count, rules)
   - "Start Exam" button (only if valid + within window)
   - Error states: expired, already submitted, not yet open, invalid token
6. Create `/app/exam/[token]/attempt/page.tsx` — the exam runtime:
   - Minimal chrome (no app sidebar)
   - Header: assessment title, countdown timer, section indicator
   - Question palette (answered/unanswered/current markers)
   - Question display area (renders by type)
   - Section navigation (Next/Prev, jump within section)
   - Autosave indicator ("Saved" / "Saving...")
   - "Submit" button → confirmation modal
7. Create question renderer components:
   - `components/exam/mcq-question.tsx` (single + multi)
   - `components/exam/true-false-question.tsx`
   - `components/exam/subjective-question.tsx` (textarea)
   - `components/exam/coding-question.tsx` (Monaco editor + language selector + Run button + test results)
   - `components/exam/question-palette.tsx`
   - `components/exam/exam-timer.tsx` (server-synced countdown)
8. Install Monaco editor: `npm install @monaco-editor/react`
9. Wire coding question "Run" to `/api/code/run` (Plan 14), submission to autosave with `codeSubmissionId`
10. Implement autosave: debounced (500ms) on answer change, plus save-on-navigate
11. Implement auto-submit: when timer hits 0, force submit

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | ExamAttempt, ExamAnswer |
| Create | `services/exam-session.ts` | Exam session logic |
| Create | `app/api/exam/[token]/route.ts` | Validate + state |
| Create | `app/api/exam/[token]/start/route.ts` | Start attempt |
| Create | `app/api/exam/[token]/answer/route.ts` | Autosave |
| Create | `app/api/exam/[token]/submit/route.ts` | Submit |
| Create | `app/exam/[token]/page.tsx` | Entry page |
| Create | `app/exam/[token]/attempt/page.tsx` | Runtime |
| Create | `components/exam/*.tsx` | Question renderers, palette, timer |
| Install | `@monaco-editor/react` | Code editor |

## 7. Testing / Verification

- [ ] Valid token → exam overview shown
- [ ] Expired token → "expired" message
- [ ] Already-submitted token → "already submitted" message
- [ ] Before start time → "not yet open" message
- [ ] Start exam → attempt created, timer begins, deadline set
- [ ] Answer MCQ → autosaves, palette marks answered
- [ ] Answer coding question → Monaco editor works, Run executes public test cases
- [ ] Navigate away and back → answers persist
- [ ] Refresh page mid-exam → state restored, timer continues (server-synced)
- [ ] Shuffle: refresh preserves the same question order
- [ ] Timer reaches 0 → auto-submits saved answers
- [ ] Manual submit → confirmation → locked, assignment SUBMITTED
- [ ] Submitting after deadline (clock manipulation) → server rejects
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: exam runtime flow, server-authoritative timer, autosave pattern, token-gated routes
- Add to `docs/project-context.md`: Plan 15 completed, exam-taking runtime live

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~25 minutes (all question types, timer, persistence)
- Documentation updates: ~5 minutes

# Plan 012 — Assessment Builder & Configuration

## 1. Objective

Build the assessment creation system that assembles questions into configurable, timed assessments with sections, scoring rules, and scheduling.

## 2. Scope

- Prisma models for assessments, sections, and assessment-questions
- Assessment configuration (duration, scoring, attempts, scheduling)
- Section-based organization of questions
- Manual question selection and auto-assembly by criteria
- Assessment builder UI
- Draft/publish workflow

### Out of Scope

- Candidate assignment/invitation (Plan 13)
- Exam-taking runtime (Plan 15)
- Proctoring configuration (Plan 18)
- Grading and results (Plan 16)

## 3. Prerequisites / Dependencies

- Plan 11 complete (question bank)
- Plan 07 (RBAC for assessment management)

## 4. Technical Approach

An `Assessment` is a container with global config (duration, attempts, scoring policy) and one or more `Section`s. Each section holds ordered questions via a join table that captures per-assessment overrides (marks may differ from the question's default).

Two assembly modes:
1. **Manual**: pick specific questions from the bank
2. **Auto**: specify criteria (e.g., "5 EASY + 3 MEDIUM tagged 'DSA'") and the system randomly selects matching questions

Draft/publish workflow prevents accidental exposure of incomplete assessments.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum AssessmentStatus {
     DRAFT
     PUBLISHED
     ARCHIVED
   }

   enum ScoringPolicy {
     STANDARD          // sum of marks
     NEGATIVE_MARKING  // deduct on wrong
   }

   model Assessment {
     id              String            @id @default(cuid())
     orgId           String
     title           String
     description     String?           @db.Text
     status          AssessmentStatus  @default(DRAFT)
     durationMinutes Int
     scoringPolicy   ScoringPolicy     @default(STANDARD)
     maxAttempts     Int               @default(1)
     shuffleQuestions Boolean          @default(false)
     shuffleOptions  Boolean           @default(false)
     passingScore    Float?
     startAt         DateTime?
     endAt           DateTime?
     createdById     String
     createdAt       DateTime          @default(now())
     updatedAt       DateTime          @updatedAt

     org             Organization      @relation(fields: [orgId], references: [id], onDelete: Cascade)
     createdBy       User              @relation(fields: [createdById], references: [id])
     sections        AssessmentSection[]

     @@index([orgId])
     @@index([status])
   }

   model AssessmentSection {
     id            String    @id @default(cuid())
     assessmentId  String
     title         String
     description   String?
     order         Int
     durationMinutes Int?    // optional per-section timer

     assessment    Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
     questions     AssessmentQuestion[]

     @@index([assessmentId])
   }

   model AssessmentQuestion {
     id          String    @id @default(cuid())
     sectionId   String
     questionId  String
     order       Int
     marksOverride Int?     // override question default marks

     section     AssessmentSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
     question    Question          @relation(fields: [questionId], references: [id])

     @@unique([sectionId, questionId])
     @@index([sectionId])
   }
   ```
2. Add reverse relation on `Question`: `assessmentQuestions AssessmentQuestion[]`
3. Run migration: `npx prisma migrate dev --name assessment_builder`
4. Create `services/assessments.ts`:
   - `createAssessment(orgId, userId, data)`
   - `updateAssessment(id, data)`
   - `addSection(assessmentId, data)` / `updateSection` / `deleteSection` / `reorderSections`
   - `addQuestions(sectionId, questionIds[])` / `removeQuestion` / `reorderQuestions`
   - `autoAssemble(sectionId, criteria)` — random selection by type/difficulty/tag
   - `publishAssessment(id)` — validates (has questions, valid config) then sets PUBLISHED
   - `computeTotalMarks(assessmentId)`
5. Create validation `lib/validators/assessment.ts`:
   - Publish requires: ≥1 section, ≥1 question, duration > 0, valid date range
6. Create API routes:
   - `/app/api/assessments/route.ts` — GET, POST
   - `/app/api/assessments/[id]/route.ts` — GET, PATCH, DELETE
   - `/app/api/assessments/[id]/sections/route.ts` — POST, reorder
   - `/app/api/assessments/[id]/sections/[sectionId]/questions/route.ts` — POST, DELETE, reorder
   - `/app/api/assessments/[id]/publish/route.ts` — POST
   - `/app/api/assessments/[id]/auto-assemble/route.ts` — POST
7. Create `/app/(protected)/assessments/page.tsx`:
   - List with status badges (Draft/Published/Archived), filters
8. Create `/app/(protected)/assessments/[id]/build/page.tsx`:
   - Assessment settings panel (title, duration, scoring, scheduling, shuffle options)
   - Section tabs/accordion
   - Per-section: question list, "Add from bank" (searchable picker), "Auto-assemble" dialog
   - Drag-to-reorder sections and questions
   - Live total marks + question count
   - "Publish" button (disabled until valid, with validation checklist)
9. Create components:
   - `components/assessments/assessment-settings.tsx`
   - `components/assessments/section-editor.tsx`
   - `components/assessments/question-picker.tsx` (modal with bank search)
   - `components/assessments/auto-assemble-dialog.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Assessment, Section, AssessmentQuestion |
| Create | `services/assessments.ts` | Assessment logic |
| Create | `lib/validators/assessment.ts` | Publish validation |
| Create | `app/api/assessments/route.ts` | List + create |
| Create | `app/api/assessments/[id]/route.ts` | CRUD |
| Create | `app/api/assessments/[id]/sections/route.ts` | Section management |
| Create | `app/api/assessments/[id]/sections/[sectionId]/questions/route.ts` | Question assignment |
| Create | `app/api/assessments/[id]/publish/route.ts` | Publish |
| Create | `app/api/assessments/[id]/auto-assemble/route.ts` | Auto-assembly |
| Create | `app/(protected)/assessments/page.tsx` | List |
| Create | `app/(protected)/assessments/[id]/build/page.tsx` | Builder |
| Create | `components/assessments/*.tsx` | Builder components |

## 7. Testing / Verification

- [ ] Create draft assessment with settings → saved
- [ ] Add section → appears in builder
- [ ] Add questions from bank to section → count updates
- [ ] Auto-assemble: "5 EASY DSA questions" → 5 matching questions added
- [ ] Reorder questions → order persists
- [ ] Total marks computed correctly (with overrides)
- [ ] Publish incomplete assessment (no questions) → blocked with reason
- [ ] Publish valid assessment → status becomes PUBLISHED
- [ ] Cross-org: can't add another org's questions
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: assessment structure (assessment → sections → questions), draft/publish rules, auto-assembly
- Add to `docs/project-context.md`: Plan 12 completed, assessment builder live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes
- Documentation updates: ~5 minutes

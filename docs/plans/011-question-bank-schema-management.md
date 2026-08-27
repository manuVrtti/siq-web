# Plan 011 — Question Bank Schema & Management

## 1. Objective

Build the question bank data model and management interface, supporting multiple question types that will power all assessments across the platform.

## 2. Scope

- Prisma models for questions, question types, tags, and options
- Support for MCQ, multi-select, coding, subjective, and true/false question types
- Question CRUD API routes (create, read, update, delete, list)
- Question bank management UI (list, filter, create, edit)
- Question tagging and difficulty classification

### Out of Scope

- Coding question test cases and Judge0 integration (Plan 14)
- Question import from CSV/Excel (Plan 20)
- AI-assisted question generation (future sprint)
- Assessment assembly (Plan 12)

## 3. Prerequisites / Dependencies

- Sprint 1 complete (Plans 01–10)
- Plan 07 (RBAC — question management is org-scoped, role-gated)
- Plan 08 (UI foundation for management pages)

## 4. Technical Approach

Questions belong to an organization and are reusable across assessments. A single `Question` model with a `type` enum handles the common fields, with type-specific data stored in structured JSON or related tables (options for MCQ, test cases for coding — the latter deferred to Plan 14).

Questions are tagged (topic, skill) and classified by difficulty (EASY/MEDIUM/HARD) so assessments can be assembled by criteria.

## 5. Implementation Steps

1. Add Prisma models to `schema.prisma`:
   ```prisma
   enum QuestionType {
     MCQ_SINGLE
     MCQ_MULTI
     TRUE_FALSE
     SUBJECTIVE
     CODING
   }

   enum Difficulty {
     EASY
     MEDIUM
     HARD
   }

   model Question {
     id            String        @id @default(cuid())
     orgId         String
     type          QuestionType
     title         String
     body          String        @db.Text
     difficulty    Difficulty    @default(MEDIUM)
     marks         Int           @default(1)
     negativeMarks Float         @default(0)
     explanation   String?       @db.Text
     createdById   String
     createdAt     DateTime      @default(now())
     updatedAt     DateTime      @updatedAt

     org           Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
     createdBy     User          @relation(fields: [createdById], references: [id])
     options       QuestionOption[]
     tags          QuestionTag[]

     @@index([orgId])
     @@index([type])
     @@index([difficulty])
   }

   model QuestionOption {
     id          String    @id @default(cuid())
     questionId  String
     text        String    @db.Text
     isCorrect   Boolean   @default(false)
     order       Int

     question    Question  @relation(fields: [questionId], references: [id], onDelete: Cascade)

     @@index([questionId])
   }

   model Tag {
     id        String        @id @default(cuid())
     orgId     String
     name      String
     category  String?       // e.g. "topic", "skill"
     createdAt DateTime      @default(now())

     org       Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
     questions QuestionTag[]

     @@unique([orgId, name])
   }

   model QuestionTag {
     questionId String
     tagId      String

     question   Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
     tag        Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

     @@id([questionId, tagId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name question_bank`
3. Create `services/questions.ts` — business logic layer:
   - `createQuestion(orgId, userId, data)` — validates type-specific rules
   - `updateQuestion(id, data)`
   - `deleteQuestion(id)` — soft or hard delete
   - `listQuestions(orgId, filters)` — filter by type, difficulty, tags, search
   - `getQuestion(id)` — with options and tags
4. Create Zod validation schemas `lib/validators/question.ts`:
   - Type-specific validation (MCQ needs ≥2 options and ≥1 correct; TRUE_FALSE needs exactly 2, etc.)
5. Create API routes:
   - `/app/api/questions/route.ts` — GET (list), POST (create)
   - `/app/api/questions/[id]/route.ts` — GET, PATCH, DELETE
   - `/app/api/tags/route.ts` — GET (list), POST (create)
   - All routes: `withRole(['COLLEGE_ADMIN', 'RECRUITER', 'SUPER_ADMIN'])` + org access check
6. Create `/app/(protected)/questions/page.tsx`:
   - Question list with filters (type, difficulty, tag, search)
   - PageHeader with "Create Question" button
   - EmptyState when no questions
   - Pagination
7. Create `/app/(protected)/questions/new/page.tsx` and `[id]/edit/page.tsx`:
   - Question form (type selector changes visible fields)
   - MCQ: dynamic option rows with "mark correct" toggle
   - Tag multi-select (with create-new-tag inline)
   - Difficulty + marks + negative marks
8. Create `components/questions/question-form.tsx` — reusable form component
9. Create `components/questions/question-card.tsx` — list item display

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Question, Option, Tag models |
| Create | `services/questions.ts` | Question business logic |
| Create | `lib/validators/question.ts` | Type-specific validation |
| Create | `app/api/questions/route.ts` | List + create |
| Create | `app/api/questions/[id]/route.ts` | Get, update, delete |
| Create | `app/api/tags/route.ts` | Tag management |
| Create | `app/(protected)/questions/page.tsx` | Question list |
| Create | `app/(protected)/questions/new/page.tsx` | Create form |
| Create | `app/(protected)/questions/[id]/edit/page.tsx` | Edit form |
| Create | `components/questions/question-form.tsx` | Form component |
| Create | `components/questions/question-card.tsx` | List item |

## 7. Testing / Verification

- [ ] Create MCQ question with 4 options, 1 correct → saved
- [ ] Create multi-select question with 2 correct options → saved
- [ ] Create true/false question → saved
- [ ] Create subjective question (no options) → saved
- [ ] Validation: MCQ with 0 correct options → rejected
- [ ] Edit question → changes persist
- [ ] Delete question → removed from list
- [ ] Filter by difficulty → correct subset shown
- [ ] Filter by tag → correct subset shown
- [ ] Search by title → matches returned
- [ ] Recruiter from Org A cannot see Org B questions
- [ ] Student role cannot access question management (403)
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: question bank schema, question types and their rules, org-scoping
- Add to `docs/project-context.md`: Plan 11 completed, question bank live

## 9. Estimated Effort

- Claude Code execution: ~55 minutes
- Manual testing: ~15 minutes
- Documentation updates: ~5 minutes

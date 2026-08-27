# Plan 021 — Section & Skill Taxonomy + Question Tagging

## 1. Objective

Build the two-axis classification foundation — topic **sections** (DSA, DBMS, Aptitude, etc.) and a normalized **skill taxonomy** beneath them — and enforce that every assessment question is tagged on both axes. This is the data foundation the entire competency diagnostic (Plans 25a/25b) and all three dashboards depend on.

## 2. Scope

- Section taxonomy (topic areas, org-scoped + platform defaults)
- Skill taxonomy (normalized skills, mapped to sections)
- Two-axis question tagging (every question → 1 section + N skills)
- Tagging enforcement (question can't be used in a diagnostic assessment without tags)
- Taxonomy management UI (placement cell / admin)
- Backfill tagging for existing questions (from Sprint 2)

### Out of Scope

- Per-student rollups (Plan 25a — the engine that consumes this)
- Dashboards (Plans 26–28)
- AI-suggested tags (Phase 2)

## 3. Prerequisites / Dependencies

- Sprint 1–2 complete (Question model, tags exist from Plan 11)
- Plan 07 (RBAC for taxonomy management)

## 4. Technical Approach

Sprint 2's Plan 11 gave questions freeform `Tag`s. That's insufficient for diagnostics — we need **structured, hierarchical competency dimensions** so scores can roll up consistently ("DSA" always means the same thing across every assessment).

Two levels:
- **Section** = coarse topic area a student is scored on (DSA, DBMS, OS, Aptitude, Verbal). This is the primary axis for section-level strength/weakness.
- **Skill** = fine-grained competency within/across sections (e.g., "Dynamic Programming", "SQL Joins", "Time Complexity"). Skills map to a parent section but can be cross-cutting.

Every diagnostic-eligible question carries exactly **one section** and **one or more skills**. This dual tagging is what lets the engine later say "weak in DSA overall, specifically weak in graphs and DP."

Platform ships seed taxonomies (common engineering topics); orgs can extend but not break the shared spine (so cross-college comparison stays meaningful).

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   model Section {
     id            String    @id @default(cuid())
     orgId         String?   // null = platform default (shared spine)
     name          String
     code          String    // stable key e.g. "DSA", "DBMS"
     description   String?
     order         Int       @default(0)
     isDefault     Boolean   @default(false)
     createdAt     DateTime  @default(now())

     org           Organization? @relation(fields: [orgId], references: [id], onDelete: Cascade)
     skills        SkillNode[]
     questionTags  QuestionSection[]

     @@unique([orgId, code])
     @@index([orgId])
   }

   model SkillNode {
     id            String    @id @default(cuid())
     orgId         String?   // null = platform default
     sectionId     String
     name          String
     code          String
     aliases       String[]  // normalization: ["dp","dynamic programming"]
     isDefault     Boolean   @default(false)
     createdAt     DateTime  @default(now())

     section       Section   @relation(fields: [sectionId], references: [id], onDelete: Cascade)
     org           Organization? @relation(fields: [orgId], references: [id], onDelete: Cascade)
     questionTags  QuestionSkill[]

     @@unique([orgId, code])
     @@index([sectionId])
   }

   model QuestionSection {
     questionId  String  @unique   // exactly one section per question
     sectionId   String

     question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
     section     Section  @relation(fields: [sectionId], references: [id], onDelete: Cascade)

     @@index([sectionId])
   }

   model QuestionSkill {
     questionId  String
     skillId     String

     question    Question  @relation(fields: [questionId], references: [id], onDelete: Cascade)
     skill       SkillNode @relation(fields: [skillId], references: [id], onDelete: Cascade)

     @@id([questionId, skillId])
     @@index([skillId])
   }
   ```
2. Add reverse relations on Question and Organization
3. Run migration: `npx prisma migrate dev --name section_skill_taxonomy`
4. Create seed script `prisma/seeds/taxonomy.ts`:
   - Platform-default sections: DSA, DBMS, OS, CN, OOP, Aptitude, Logical Reasoning, Verbal, Coding
   - Default skills under each (e.g., DSA → Arrays, Linked Lists, Trees, Graphs, DP, Sorting; DBMS → SQL Joins, Normalization, Transactions, Indexing)
5. Create `services/taxonomy.ts`:
   - `listSections(orgId)` — platform defaults + org custom
   - `createSection` / `updateSection` / `reorderSections` (org custom only; defaults read-only)
   - `listSkills(orgId, sectionId?)`
   - `createSkill` / `updateSkill`
   - `normalizeSkill(raw, orgId)` — alias → canonical SkillNode
6. Create `services/question-tagging.ts`:
   - `tagQuestion(questionId, sectionId, skillIds[])` — validates one section, ≥1 skill
   - `getQuestionTags(questionId)`
   - `bulkTag(tags[])` — batch tagging
   - `isDiagnosticReady(questionId)` — has section + ≥1 skill
   - `listUntaggedQuestions(orgId)` — for backfill
7. Extend question validation (Plan 11): diagnostic-eligible questions require section + skill
8. Create API routes:
   - `/app/api/taxonomy/sections/route.ts` — GET, POST
   - `/app/api/taxonomy/sections/[id]/route.ts` — PATCH, DELETE
   - `/app/api/taxonomy/skills/route.ts` — GET, POST
   - `/app/api/taxonomy/skills/[id]/route.ts` — PATCH, DELETE
   - `/app/api/questions/[id]/tags/route.ts` — GET, PUT (set section + skills)
   - `/app/api/questions/untagged/route.ts` — GET (backfill queue)
9. Create management UI:
   - `/app/(protected)/taxonomy/page.tsx` — section + skill tree management
   - Extend question form (Plan 11): section dropdown (required) + skill multi-select (required, filtered by section)
   - `/app/(protected)/questions/backfill/page.tsx` — bulk-tag untagged questions
10. Create components:
    - `components/taxonomy/section-tree.tsx`
    - `components/taxonomy/skill-editor.tsx`
    - `components/questions/tag-selector.tsx` (section + skill picker)
    - `components/questions/backfill-tagger.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Section, SkillNode, QuestionSection, QuestionSkill |
| Create | `prisma/seeds/taxonomy.ts` | Default sections + skills |
| Create | `services/taxonomy.ts` | Taxonomy logic |
| Create | `services/question-tagging.ts` | Two-axis tagging |
| Modify | `lib/validators/question.ts` | Require section + skill |
| Create | `app/api/taxonomy/*/route.ts` | Taxonomy APIs |
| Create | `app/api/questions/[id]/tags/route.ts` | Question tagging |
| Create | `app/api/questions/untagged/route.ts` | Backfill queue |
| Create | `app/(protected)/taxonomy/page.tsx` | Taxonomy management |
| Modify | `components/questions/question-form.tsx` | Section + skill fields |
| Create | `app/(protected)/questions/backfill/page.tsx` | Bulk backfill |
| Create | `components/taxonomy/*.tsx`, `components/questions/tag-selector.tsx` | UI |

## 7. Testing / Verification

- [ ] Seed runs → default sections + skills present
- [ ] Create org-custom section → appears alongside defaults
- [ ] Default sections are read-only (can't delete platform spine)
- [ ] Tag question: 1 section + 3 skills → saved
- [ ] Tag question with 0 skills → rejected (needs ≥1)
- [ ] Tag question with 2 sections → rejected (exactly 1)
- [ ] Skill multi-select filters to chosen section's skills
- [ ] Alias normalization: "dp" → "Dynamic Programming"
- [ ] Untagged questions surface in backfill queue
- [ ] Bulk-tag 10 questions → all tagged
- [ ] `isDiagnosticReady` correct for tagged vs untagged
- [ ] Cross-org: can't edit another org's custom taxonomy
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: two-axis taxonomy (section + skill), platform spine vs org-custom, tagging enforcement, `isDiagnosticReady`
- Add to `CLAUDE.md`: "Every diagnostic question MUST have exactly 1 section + ≥1 skill — this is the backbone of all competency analytics"
- Add to `docs/project-context.md`: Phase 1 Plan 21 completed, competency taxonomy live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes
- Documentation updates: ~5 minutes

# Plan 036 — Resume Management & Candidate Search

## 1. Objective

Build resume upload/parsing and a searchable candidate database, letting recruiters proactively discover students by skills, academics, and profile attributes across partnered colleges.

## 2. Scope

- Resume upload and storage
- Resume parsing (extract skills, education, experience)
- Structured student profile enrichment
- Recruiter candidate search with filters
- Skill tagging and normalization
- Candidate shortlisting (saved lists)
- Privacy controls (student visibility settings)

### Out of Scope

- AI-based resume scoring/ranking (Sprint 6)
- Automated candidate-job matching recommendations (Sprint 6)
- Bulk resume import (uses individual upload; bulk in Plan 20 pattern if needed)

## 3. Prerequisites / Dependencies

- Plan 22 complete (StudentProfile)
- Plan 21 complete (companies + college partnerships — scopes search)
- Plan 09 (storage for resumes)

## 4. Technical Approach

Students upload resumes (PDF/DOCX) to Supabase Storage. A parser extracts structured data (skills, education, experience) to enrich the profile and make students searchable. Parsing uses a library (e.g., `pdf-parse` for text) plus heuristic/keyword extraction for skills against a normalized skill taxonomy.

Recruiter search is scoped: a recruiter can only search students from colleges their company has an APPROVED partnership with (Plan 21). Students control visibility (opt-in/opt-out of proactive search).

Shortlists let recruiters save candidates for later outreach or bulk-invite to jobs.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   model Resume {
     id            String    @id @default(cuid())
     userId        String
     fileUrl       String
     fileName      String
     parsedText    String?   @db.Text
     isPrimary     Boolean   @default(true)
     uploadedAt    DateTime  @default(now())

     user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId])
   }

   model Skill {
     id          String    @id @default(cuid())
     name        String    @unique   // normalized
     category    String?             // "language", "framework", "tool"
     aliases     String[]            // e.g. ["js", "javascript"]

     students    StudentSkill[]
   }

   model StudentSkill {
     userId      String
     skillId     String
     source      String    // "resume", "manual", "assessment"
     proficiency String?   // optional

     skill       Skill @relation(fields: [skillId], references: [id], onDelete: Cascade)

     @@id([userId, skillId])
     @@index([skillId])
   }

   model CandidateShortlist {
     id            String    @id @default(cuid())
     companyOrgId  String
     name          String
     createdById   String
     createdAt     DateTime  @default(now())

     entries       ShortlistEntry[]

     @@index([companyOrgId])
   }

   model ShortlistEntry {
     shortlistId   String
     userId        String
     addedAt       DateTime @default(now())
     notes         String?

     shortlist     CandidateShortlist @relation(fields: [shortlistId], references: [id], onDelete: Cascade)

     @@id([shortlistId, userId])
   }
   ```
2. Add visibility field to StudentProfile:
   ```prisma
   // Add to StudentProfile:
   searchable    Boolean @default(true)  // opt in/out of recruiter search
   ```
3. Run migration: `npx prisma migrate dev --name resume_search`
4. Install parsing: `npm install pdf-parse mammoth` (PDF + DOCX text)
5. Create `services/resume.ts`:
   - `uploadResume(userId, file)` — store + set primary
   - `parseResume(resumeId)` — extract text, run skill extraction
   - `extractSkills(text)` — match against Skill taxonomy (aliases-aware)
6. Create `services/skills.ts`:
   - `seedSkillTaxonomy()` — initial common skills (languages, frameworks, tools)
   - `normalizeSkill(raw)` — map alias → canonical
   - `addStudentSkill(userId, skillId, source)`
7. Create `services/candidate-search.ts`:
   - `searchCandidates(companyOrgId, filters)` — scoped to partnered colleges + searchable students
     - Filters: skills, branch, minCgpa, batchYear, college, keyword (resume text)
   - Returns paginated results respecting privacy
8. Create `services/shortlists.ts`:
   - `createShortlist` / `addToShortlist` / `removeFromShortlist` / `listShortlists`
9. Create API routes:
   - `/app/api/students/me/resume/route.ts` — POST (upload), GET
   - `/app/api/students/me/skills/route.ts` — GET, POST, DELETE (manual skills)
   - `/app/api/students/me/visibility/route.ts` — PATCH (searchable toggle)
   - `/app/api/candidates/search/route.ts` — POST (recruiter search)
   - `/app/api/shortlists/route.ts` — GET, POST
   - `/app/api/shortlists/[id]/entries/route.ts` — POST, DELETE
10. Create student pages:
    - `/app/(protected)/profile/resume/page.tsx` — upload resume, view parsed skills, edit skills, visibility toggle
11. Create recruiter pages:
    - `/app/(protected)/candidates/search/page.tsx` — search interface with filters + results
    - `/app/(protected)/candidates/shortlists/page.tsx` — manage shortlists
    - `/app/(protected)/candidates/[userId]/page.tsx` — candidate profile view (recruiter, if searchable + partnered)
12. Create components:
    - `components/resume/resume-upload.tsx`
    - `components/resume/skill-editor.tsx`
    - `components/search/candidate-filters.tsx`
    - `components/search/candidate-result-card.tsx`
    - `components/search/shortlist-selector.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Resume, Skill, StudentSkill, Shortlist |
| Install | `pdf-parse`, `mammoth` | Resume text extraction |
| Create | `services/resume.ts` | Resume + parsing |
| Create | `services/skills.ts` | Skill taxonomy |
| Create | `services/candidate-search.ts` | Scoped search |
| Create | `services/shortlists.ts` | Shortlist logic |
| Create | `app/api/students/me/resume/route.ts` | Resume API |
| Create | `app/api/students/me/skills/route.ts` | Skills API |
| Create | `app/api/students/me/visibility/route.ts` | Privacy toggle |
| Create | `app/api/candidates/search/route.ts` | Search API |
| Create | `app/api/shortlists/*/route.ts` | Shortlist APIs |
| Create | `app/(protected)/profile/resume/page.tsx` | Student resume page |
| Create | `app/(protected)/candidates/search/page.tsx` | Recruiter search |
| Create | `app/(protected)/candidates/shortlists/page.tsx` | Shortlists |
| Create | `app/(protected)/candidates/[userId]/page.tsx` | Candidate profile |
| Create | `components/resume/*.tsx`, `components/search/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Student uploads PDF resume → stored, text parsed
- [ ] Skills extracted from resume → appear in profile
- [ ] Student adds manual skill → normalized against taxonomy
- [ ] Student toggles visibility off → excluded from recruiter search
- [ ] Recruiter searches by skill → matching searchable students returned
- [ ] Search scoped to partnered colleges only (non-partner students excluded)
- [ ] Filter by CGPA + branch → correct subset
- [ ] Keyword search hits resume text
- [ ] Recruiter creates shortlist → adds candidates
- [ ] Recruiter views candidate profile (partnered + searchable) → allowed
- [ ] Recruiter views non-searchable / non-partner student → blocked
- [ ] DOCX resume parses correctly
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: resume parsing, skill taxonomy/normalization, search scoping rules, privacy model
- Add to `CLAUDE.md`: "Candidate search is ALWAYS scoped to APPROVED college partnerships + searchable students"
- Add to `docs/project-context.md`: Plan 25 completed, candidate search live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (parsing, search scoping, privacy)
- Documentation updates: ~5 minutes

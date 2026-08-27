# Plan 033 — Job Postings & Role Management

## 1. Objective

Build the job posting system that lets verified companies publish roles to partnered colleges, with eligibility criteria, and lets students discover and view opportunities.

## 2. Scope

- Job posting model (role details, compensation, location, type)
- Eligibility criteria (branch, CGPA, batch year, backlogs)
- Job posting CRUD for recruiters
- Targeting: which partnered colleges a job is visible to
- Student-facing job discovery and detail pages
- Draft/publish/close lifecycle

### Out of Scope

- Applications (Plan 24)
- Linking assessments to jobs (Plan 23)
- Interview scheduling (Plan 26)
- Offer letters (Plan 27)

## 3. Prerequisites / Dependencies

- Plan 21 complete (companies + college partnerships)
- Plan 07 (RBAC)

## 4. Technical Approach

A `JobPosting` belongs to a company and targets one or more partnered colleges (only APPROVED relations). Eligibility criteria are structured so the system can later auto-filter eligible students. Jobs have a lifecycle: DRAFT → PUBLISHED → CLOSED.

Student visibility is computed: a student sees a job if their college is targeted AND they meet (or the posting doesn't restrict) eligibility. Eligibility enforcement happens at application time (Plan 24), but discovery can pre-filter.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum JobType {
     FULL_TIME
     INTERNSHIP
     INTERN_PLUS_PPO
     CONTRACT
   }

   enum JobStatus {
     DRAFT
     PUBLISHED
     CLOSED
   }

   enum WorkMode {
     ONSITE
     REMOTE
     HYBRID
   }

   model JobPosting {
     id              String    @id @default(cuid())
     companyOrgId    String
     title           String
     description     String    @db.Text
     responsibilities String?  @db.Text
     jobType         JobType
     workMode        WorkMode  @default(ONSITE)
     location        String?
     ctcMin          Float?
     ctcMax          Float?
     stipend         Float?
     openings        Int       @default(1)
     status          JobStatus @default(DRAFT)
     applicationDeadline DateTime?
     createdById     String
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt

     company         Organization @relation(fields: [companyOrgId], references: [id], onDelete: Cascade)
     eligibility     JobEligibility?
     targetColleges  JobTargetCollege[]

     @@index([companyOrgId])
     @@index([status])
   }

   model JobEligibility {
     id            String    @id @default(cuid())
     jobId         String    @unique
     branches      String[]  // allowed branches, empty = all
     minCgpa       Float?
     batchYears    Int[]     // eligible graduation years
     maxBacklogs   Int?
     genderCriteria String?  // optional diversity drives

     job           JobPosting @relation(fields: [jobId], references: [id], onDelete: Cascade)
   }

   model JobTargetCollege {
     jobId         String
     collegeOrgId  String

     job           JobPosting   @relation(fields: [jobId], references: [id], onDelete: Cascade)
     college       Organization @relation(fields: [collegeOrgId], references: [id], onDelete: Cascade)

     @@id([jobId, collegeOrgId])
   }
   ```
2. Extend student profile with academic fields (needed for eligibility):
   ```prisma
   model StudentProfile {
     id            String    @id @default(cuid())
     userId        String    @unique
     collegeOrgId  String
     branch        String?
     cgpa          Float?
     batchYear     Int?
     backlogs      Int       @default(0)
     rollNumber    String?
     resumeUrl     String?

     user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([collegeOrgId])
   }
   ```
3. Run migration: `npx prisma migrate dev --name job_postings`
4. Create `services/jobs.ts`:
   - `createJob(companyOrgId, userId, data)` — with eligibility + targets
   - `updateJob(id, data)`
   - `publishJob(id)` — validates targets are APPROVED partners
   - `closeJob(id)`
   - `listCompanyJobs(companyOrgId, filters)`
   - `listJobsForStudent(userId)` — targeted colleges + eligibility-aware
   - `getJobDetail(id)`
   - `checkEligibility(jobId, studentProfile)` — returns eligible + reasons
5. Create `services/student-profile.ts`:
   - `getStudentProfile(userId)` / `updateStudentProfile(userId, data)`
6. Create API routes:
   - `/app/api/jobs/route.ts` — GET, POST
   - `/app/api/jobs/[id]/route.ts` — GET, PATCH, DELETE
   - `/app/api/jobs/[id]/publish/route.ts` — POST
   - `/app/api/jobs/[id]/close/route.ts` — POST
   - `/app/api/students/me/profile/route.ts` — GET, PATCH
7. Create recruiter pages:
   - `/app/(protected)/jobs/page.tsx` — company's job list
   - `/app/(protected)/jobs/new/page.tsx` — create job (details, eligibility, target colleges)
   - `/app/(protected)/jobs/[id]/edit/page.tsx`
8. Create student pages:
   - `/app/(protected)/opportunities/page.tsx` — job discovery (eligible jobs, filters)
   - `/app/(protected)/opportunities/[id]/page.tsx` — job detail + "Apply" (wired in Plan 24)
   - `/app/(protected)/profile/academic/page.tsx` — student academic profile + resume upload
9. Create college-admin view:
   - `/app/(protected)/college/jobs/page.tsx` — jobs targeting this college (oversight)
10. Create components:
    - `components/jobs/job-form.tsx`
    - `components/jobs/eligibility-editor.tsx`
    - `components/jobs/job-card.tsx`
    - `components/jobs/eligibility-badge.tsx` (eligible/not-eligible for student)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | JobPosting, JobEligibility, JobTargetCollege, StudentProfile |
| Create | `services/jobs.ts` | Job logic |
| Create | `services/student-profile.ts` | Student profile |
| Create | `app/api/jobs/*/route.ts` | Job APIs |
| Create | `app/api/students/me/profile/route.ts` | Profile API |
| Create | `app/(protected)/jobs/*` | Recruiter job pages |
| Create | `app/(protected)/opportunities/*` | Student job pages |
| Create | `app/(protected)/profile/academic/page.tsx` | Student profile |
| Create | `app/(protected)/college/jobs/page.tsx` | College oversight |
| Create | `components/jobs/*.tsx` | Job components |

## 7. Testing / Verification

- [ ] Recruiter creates job with eligibility + target colleges → DRAFT
- [ ] Publish job targeting non-partner college → blocked
- [ ] Publish job targeting approved partner → PUBLISHED
- [ ] Student completes academic profile → saved with resume
- [ ] Eligible student sees job in opportunities
- [ ] Ineligible student (low CGPA) → job hidden or marked ineligible
- [ ] Student in non-targeted college → doesn't see job
- [ ] Job detail shows all info + eligibility status
- [ ] Close job → no longer in student discovery
- [ ] College admin sees jobs targeting their college
- [ ] Recruiter can't edit another company's jobs
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: job posting lifecycle, eligibility model, student visibility computation, StudentProfile
- Add to `docs/project-context.md`: Plan 22 completed, job postings live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes
- Documentation updates: ~5 minutes

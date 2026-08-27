# Plan 039 — Campus Drive Orchestration

## 1. Objective

Build the campus drive (placement event) system that college placement cells use to organize company visits, coordinate multiple jobs under one drive, manage schedules, and track drive-wide outcomes — the operational heartbeat of Indian campus placements.

## 2. Scope

- Campus drive model (a company's placement event at a college)
- Multi-job drives (one company, multiple roles in one visit)
- Drive scheduling and day-of coordination
- Student registration/eligibility for drives
- Drive-level dashboard for placement cells
- Drive timeline and status tracking
- Pre-placement talk (PPT) scheduling

### Out of Scope

- Real-time day-of live updates (Sprint 5)
- Automated logistics (rooms, catering)
- Notifications (Sprint 4 — basic here)

## 3. Prerequisites / Dependencies

- Plan 21 (companies + partnerships)
- Plan 22 (jobs)
- Plan 24 (applications)
- Plan 26 (interviews — drives coordinate interview scheduling)

## 4. Technical Approach

A `CampusDrive` is organized by a college placement cell (or jointly with a company) for a specific date range. It bundles one or more `JobPosting`s from a single company (e.g., "Infosys Drive 2026" with SDE + Systems Engineer roles). Students register for the drive; the drive dashboard shows the funnel across all its jobs.

This is an orchestration layer on top of existing primitives (jobs, applications, rounds, interviews) — it doesn't replace them, it coordinates them. Placement cells get a single pane of glass for the whole event.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum DriveStatus {
     PLANNED
     ANNOUNCED
     REGISTRATION_OPEN
     IN_PROGRESS
     COMPLETED
     CANCELLED
   }

   model CampusDrive {
     id            String      @id @default(cuid())
     collegeOrgId  String
     companyOrgId  String
     title         String
     description   String?     @db.Text
     status        DriveStatus @default(PLANNED)
     startDate     DateTime
     endDate       DateTime
     registrationDeadline DateTime?
     venue         String?
     pptScheduledAt DateTime?   // pre-placement talk
     coordinatorId String       // placement cell contact
     createdAt     DateTime    @default(now())

     college       Organization @relation("CollegeDrives", fields: [collegeOrgId], references: [id])
     company       Organization @relation("CompanyDrives", fields: [companyOrgId], references: [id])
     jobs          DriveJob[]
     registrations DriveRegistration[]

     @@index([collegeOrgId])
     @@index([companyOrgId])
     @@index([status])
   }

   model DriveJob {
     driveId       String
     jobId         String

     drive         CampusDrive @relation(fields: [driveId], references: [id], onDelete: Cascade)
     job           JobPosting  @relation(fields: [jobId], references: [id], onDelete: Cascade)

     @@id([driveId, jobId])
   }

   model DriveRegistration {
     id            String    @id @default(cuid())
     driveId       String
     userId        String
     registeredAt  DateTime  @default(now())

     drive         CampusDrive @relation(fields: [driveId], references: [id], onDelete: Cascade)
     user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([driveId, userId])
     @@index([driveId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name campus_drives`
3. Create `services/drives.ts`:
   - `createDrive(collegeOrgId, data)` — placement cell creates
   - `addJobToDrive(driveId, jobId)` — link company's jobs
   - `updateDriveStatus(driveId, status)` — lifecycle transitions
   - `registerForDrive(driveId, userId)` — eligibility check across drive jobs
   - `getDriveOverview(driveId)` — funnel across all jobs (registered → applied → in-rounds → placed)
   - `listCollegeDrives(collegeOrgId, filters)`
   - `listStudentDrives(userId)` — eligible/registered drives
   - `getDriveSchedule(driveId)` — PPT + round timings across jobs
4. Create API routes:
   - `/app/api/drives/route.ts` — GET, POST
   - `/app/api/drives/[id]/route.ts` — GET, PATCH
   - `/app/api/drives/[id]/jobs/route.ts` — POST, DELETE
   - `/app/api/drives/[id]/status/route.ts` — POST
   - `/app/api/drives/[id]/register/route.ts` — POST (student)
   - `/app/api/students/me/drives/route.ts` — GET
5. Create placement-cell pages:
   - `/app/(protected)/drives/page.tsx` — all college drives (list + calendar)
   - `/app/(protected)/drives/new/page.tsx` — create drive, add jobs, set schedule
   - `/app/(protected)/drives/[id]/page.tsx` — drive dashboard:
     - Overview funnel across all jobs
     - Registration list
     - Per-job pipeline links (Plan 24)
     - Schedule/timeline (PPT, rounds)
     - Status controls
6. Create student pages:
   - `/app/(protected)/drives-open/page.tsx` — eligible drives, register
   - `/app/(protected)/drives-open/[id]/page.tsx` — drive detail, jobs, PPT info, register
7. Create company view:
   - `/app/(protected)/company/drives/page.tsx` — drives at partner colleges featuring their jobs
8. Create components:
   - `components/drives/drive-form.tsx`
   - `components/drives/drive-dashboard.tsx`
   - `components/drives/drive-funnel.tsx` (aggregate across jobs)
   - `components/drives/drive-timeline.tsx`
   - `components/drives/drive-card.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | CampusDrive, DriveJob, DriveRegistration |
| Create | `services/drives.ts` | Drive orchestration |
| Create | `app/api/drives/*/route.ts` | Drive APIs |
| Create | `app/api/students/me/drives/route.ts` | Student drives |
| Create | `app/(protected)/drives/*` | Placement cell pages |
| Create | `app/(protected)/drives-open/*` | Student drive pages |
| Create | `app/(protected)/company/drives/page.tsx` | Company drives view |
| Create | `components/drives/*.tsx` | Drive components |

## 7. Testing / Verification

- [ ] Placement cell creates drive → PLANNED
- [ ] Add multiple company jobs to drive
- [ ] Set PPT schedule + venue
- [ ] Transition status: PLANNED → ANNOUNCED → REGISTRATION_OPEN
- [ ] Eligible student registers → registration recorded
- [ ] Ineligible student (no matching job eligibility) → blocked
- [ ] Registration deadline passed → registration closed
- [ ] Drive dashboard shows funnel across all jobs
- [ ] Per-job pipelines accessible from drive
- [ ] Company sees drives featuring their jobs at partner colleges
- [ ] Drive timeline shows PPT + round schedule
- [ ] Complete drive → COMPLETED, outcomes locked
- [ ] Only college placement cell can manage their drives
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: campus drive as orchestration layer, drive lifecycle, multi-job drives, registration + funnel
- Add to `docs/project-context.md`: Plan 28 completed, campus drive orchestration live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes
- Documentation updates: ~5 minutes

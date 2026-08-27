# Plan 023 — Mock Drive Orchestration (Dual Mode)

## 1. Objective

Build the mock placement drive — the core MVP loop. A college placement cell sets up a simulated recruitment drive (either fully college-simulated OR fronted by a sample company profile), bundles assessment rounds, and registers students — giving them realistic placement practice while generating the data the diagnostics feed on.

## 2. Scope

- Mock drive model with dual mode (COLLEGE_SIMULATED / SAMPLE_COMPANY)
- Simulated employer concept (no real hiring, no real company account needed)
- Multi-round mock drives (assessment rounds from Sprint 2, reused)
- Student registration + eligibility (department, batch, CGPA)
- Drive scheduling (rounds, timing)
- Drive setup UI for placement cell / HOD
- Cutoffs and mock "shortlisting" per round

### Out of Scope

- The runtime students experience (Plan 24 — next)
- Real company accounts / real offers (Phase 2)
- Competency scoring (Plans 25a/25b)
- Dashboards (Plans 26–28)

## 3. Prerequisites / Dependencies

- Plan 21 (section/skill taxonomy — drive assessments should be tagged)
- Plan 22 (departments — drives can target departments)
- Sprint 2 Plans 12, 13, 16 (assessments, assignment, grading — reused wholesale)

## 4. Technical Approach

A mock drive is an **orchestration layer over the Sprint 2 assessment engine** — it does NOT need the Sprint 3 real-recruitment marketplace (company onboarding, job postings, offers). That's the key simplification your MVP unlocks.

Dual mode:
- **COLLEGE_SIMULATED**: the placement cell invents the employer ("Mock Tech Drive — Product Company Profile"). No company account. A lightweight `SimulatedEmployer` holds the name, logo, description, and "role" details for realism.
- **SAMPLE_COMPANY**: uses a real/sample `CompanyProfile` (from Sprint 3 Plan 21 if present) as the front, but still no real hiring — assessments and shortlisting only.

Both modes share the same drive → rounds → registration → cutoff machinery. Each round links an existing Sprint 2 assessment (already SEB-enforced, proctored, graded). Cutoffs produce mock shortlists, mirroring a real drive's pressure without real stakes.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum MockDriveMode {
     COLLEGE_SIMULATED
     SAMPLE_COMPANY
   }

   enum MockDriveStatus {
     DRAFT
     SCHEDULED
     REGISTRATION_OPEN
     IN_PROGRESS
     COMPLETED
     ARCHIVED
   }

   enum MockRoundOutcome {
     PENDING
     SHORTLISTED
     ELIMINATED
   }

   model MockDrive {
     id            String          @id @default(cuid())
     collegeOrgId  String
     mode          MockDriveMode
     title         String
     description   String?         @db.Text
     status        MockDriveStatus @default(DRAFT)
     employerName  String          // simulated or sample company name
     employerLogo  String?
     roleTitle     String          // e.g. "Software Engineer (Mock)"
     roleCtc       String?         // display only, e.g. "12 LPA (indicative)"
     sampleCompanyOrgId String?    // set when mode = SAMPLE_COMPANY
     startDate     DateTime?
     endDate       DateTime?
     registrationDeadline DateTime?
     createdById   String
     createdAt     DateTime        @default(now())

     college       Organization    @relation(fields: [collegeOrgId], references: [id], onDelete: Cascade)
     rounds        MockDriveRound[]
     targets       MockDriveTarget[]
     registrations MockDriveRegistration[]

     @@index([collegeOrgId])
     @@index([status])
   }

   model MockDriveRound {
     id            String    @id @default(cuid())
     driveId       String
     name          String
     order         Int
     assessmentId  String    // links Sprint 2 assessment
     cutoffScore   Float?
     scheduledAt   DateTime?

     drive         MockDrive  @relation(fields: [driveId], references: [id], onDelete: Cascade)
     assessment    Assessment @relation(fields: [assessmentId], references: [id])

     @@index([driveId])
   }

   model MockDriveTarget {
     driveId       String
     departmentId  String
     batchYear     Int?

     drive         MockDrive  @relation(fields: [driveId], references: [id], onDelete: Cascade)

     @@id([driveId, departmentId])
   }

   model MockDriveRegistration {
     id            String    @id @default(cuid())
     driveId       String
     userId        String
     currentRound  Int       @default(0)
     eliminated    Boolean   @default(false)
     registeredAt  DateTime  @default(now())

     drive         MockDrive @relation(fields: [driveId], references: [id], onDelete: Cascade)
     user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     roundResults  MockRoundResult[]

     @@unique([driveId, userId])
     @@index([driveId])
   }

   model MockRoundResult {
     id              String            @id @default(cuid())
     registrationId  String
     roundId         String
     assignmentId    String?           // Sprint 2 AssessmentAssignment
     score           Float?
     outcome         MockRoundOutcome  @default(PENDING)
     decidedAt       DateTime?

     registration    MockDriveRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)

     @@index([registrationId])
     @@index([roundId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name mock_drives`
3. Create `services/mock-drives.ts`:
   - `createDrive(collegeOrgId, userId, data)` — mode-aware (validates sampleCompanyOrgId if SAMPLE_COMPANY)
   - `addRound(driveId, assessmentId, cutoff, order)` — links Sprint 2 assessment
   - `reorderRounds` / `updateRound` / `removeRound`
   - `setTargets(driveId, departments[], batchYears[])`
   - `updateStatus(driveId, status)` — lifecycle
   - `getDriveDetail(driveId)` — full config
   - `listCollegeDrives(collegeOrgId, filters)` — scoped (HOD sees drives targeting their dept)
   - `validateDrive(driveId)` — ≥1 round, each round has published assessment, targets set
4. Create `services/mock-drive-registration.ts`:
   - `registerStudent(driveId, userId)` — eligibility check (department target + batch + CGPA), respects deadline
   - `bulkRegister(driveId, userIds)` — placement cell auto-enrolls a cohort
   - `getEligibleStudents(driveId)` — target-matching students
   - `listRegistrations(driveId)` — with current round + status
5. Create API routes:
   - `/app/api/mock-drives/route.ts` — GET, POST
   - `/app/api/mock-drives/[id]/route.ts` — GET, PATCH
   - `/app/api/mock-drives/[id]/rounds/route.ts` — POST, reorder
   - `/app/api/mock-drives/[id]/targets/route.ts` — PUT
   - `/app/api/mock-drives/[id]/status/route.ts` — POST
   - `/app/api/mock-drives/[id]/register/route.ts` — POST (student self-register)
   - `/app/api/mock-drives/[id]/bulk-register/route.ts` — POST (placement cell)
6. Create placement-cell / HOD setup UI:
   - `/app/(protected)/mock-drives/page.tsx` — drive list (scoped by role)
   - `/app/(protected)/mock-drives/new/page.tsx` — creation wizard:
     - Step 1: mode (simulated vs sample company)
     - Step 2: employer details (name, logo, role, indicative CTC)
     - Step 3: rounds (link assessments, set cutoffs, schedule)
     - Step 4: targets (departments, batch years)
     - Step 5: review + save
   - `/app/(protected)/mock-drives/[id]/manage/page.tsx` — manage drive, registrations, status
7. Create components:
   - `components/mock-drives/drive-wizard.tsx`
   - `components/mock-drives/mode-selector.tsx`
   - `components/mock-drives/simulated-employer-form.tsx`
   - `components/mock-drives/round-linker.tsx` (reuses assessment picker)
   - `components/mock-drives/target-selector.tsx` (departments + batch)
   - `components/mock-drives/registration-manager.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | MockDrive, Round, Target, Registration, RoundResult |
| Create | `services/mock-drives.ts` | Drive orchestration |
| Create | `services/mock-drive-registration.ts` | Registration + eligibility |
| Create | `app/api/mock-drives/*/route.ts` | Drive APIs |
| Create | `app/(protected)/mock-drives/page.tsx` | Drive list |
| Create | `app/(protected)/mock-drives/new/page.tsx` | Creation wizard |
| Create | `app/(protected)/mock-drives/[id]/manage/page.tsx` | Management |
| Create | `components/mock-drives/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Create COLLEGE_SIMULATED drive → simulated employer saved, no company account needed
- [ ] Create SAMPLE_COMPANY drive → linked to sample company profile
- [ ] Add rounds linking published Sprint 2 assessments
- [ ] Set cutoffs per round
- [ ] Target CSE + ECE, batch 2026 → targets saved
- [ ] Publish drive missing rounds → blocked
- [ ] Eligible student self-registers → registration created
- [ ] Ineligible student (wrong department) → blocked
- [ ] Placement cell bulk-registers a cohort → all enrolled
- [ ] Registration after deadline → blocked
- [ ] HOD sees only drives targeting their department
- [ ] Placement Head sees all college drives
- [ ] Status transitions: DRAFT → SCHEDULED → REGISTRATION_OPEN → IN_PROGRESS
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: mock drive as orchestration over Sprint 2 engine, dual mode, simulated employer, target-based eligibility
- Add to `CLAUDE.md`: "Mock drives reuse Sprint 2 assessments/grading wholesale — no real-recruitment machinery required"
- Add to `docs/project-context.md`: Phase 1 Plan 23 completed, mock drive setup live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (both modes, eligibility, scoping)
- Documentation updates: ~5 minutes

# Plan 013 — Candidate Management & Assessment Assignment

## 1. Objective

Build the system for managing candidates (students), grouping them into batches, and assigning/inviting them to assessments with unique access links.

## 2. Scope

- Prisma models for candidate batches, assessment assignments, and invitations
- Candidate list and batch management UI
- Bulk candidate import (email/phone list)
- Assessment assignment to candidates/batches
- Unique per-candidate assessment invitation links
- Invitation email/SMS dispatch

### Out of Scope

- Exam-taking runtime (Plan 15)
- Candidate self-registration flow (uses existing Firebase auth from Sprint 1)
- Result viewing (Plan 16)
- CSV question import (Plan 20)

## 3. Prerequisites / Dependencies

- Plan 12 complete (assessments exist to assign)
- Plan 05 (MSG91 for SMS invitations)
- Plan 07 (RBAC — assignment is admin/recruiter action)

## 4. Technical Approach

Candidates are `User` records with STUDENT role, linked to an org. Batches group candidates (e.g., "2026 CSE Batch"). Assessments are assigned to individual candidates or entire batches, creating `AssessmentAssignment` records — each with a unique token that forms the candidate's personal exam link.

Invitations go out via email (link) and/or SMS (MSG91, link). The link resolves to the exam entry page (Plan 15), gated by the token.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum AssignmentStatus {
     INVITED
     STARTED
     SUBMITTED
     EXPIRED
   }

   model Batch {
     id          String    @id @default(cuid())
     orgId       String
     name        String
     description String?
     createdAt   DateTime  @default(now())

     org         Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
     members     BatchMember[]

     @@index([orgId])
   }

   model BatchMember {
     batchId    String
     userId     String
     addedAt    DateTime @default(now())

     batch      Batch @relation(fields: [batchId], references: [id], onDelete: Cascade)
     user       User  @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@id([batchId, userId])
   }

   model AssessmentAssignment {
     id            String            @id @default(cuid())
     assessmentId  String
     userId        String
     token         String            @unique @default(cuid())
     status        AssignmentStatus  @default(INVITED)
     invitedAt     DateTime          @default(now())
     startedAt     DateTime?
     submittedAt   DateTime?
     expiresAt     DateTime?

     assessment    Assessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
     user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([assessmentId, userId])
     @@index([token])
     @@index([userId])
     @@index([status])
   }
   ```
2. Add reverse relations on User, Assessment, Organization
3. Run migration: `npx prisma migrate dev --name candidate_management`
4. Create `services/candidates.ts`:
   - `listCandidates(orgId, filters)` — STUDENT users in org
   - `importCandidates(orgId, list)` — bulk create/invite by email or phone (creates User records with pending state)
   - `createBatch` / `addToBatch` / `removeFromBatch` / `listBatches`
5. Create `services/assignments.ts`:
   - `assignToCandidate(assessmentId, userId)` — creates assignment + token
   - `assignToBatch(assessmentId, batchId)` — bulk assign to all batch members
   - `listAssignments(assessmentId)` — with candidate + status
   - `revokeAssignment(id)`
   - `getAssignmentByToken(token)` — for exam entry resolution
6. Create `services/invitations.ts`:
   - `sendInvitation(assignmentId, channels)` — email and/or SMS
   - Email: link to `{APP_URL}/exam/{token}`
   - SMS via MSG91: DLT-compliant template with link
   - Reuses email infra (add basic transactional email — Resend or Nodemailer)
7. Create API routes:
   - `/app/api/candidates/route.ts` — GET (list)
   - `/app/api/candidates/import/route.ts` — POST (bulk)
   - `/app/api/batches/route.ts` — GET, POST
   - `/app/api/batches/[id]/members/route.ts` — POST, DELETE
   - `/app/api/assessments/[id]/assignments/route.ts` — GET, POST (assign)
   - `/app/api/assignments/[id]/invite/route.ts` — POST (send invitation)
   - `/app/api/assignments/[id]/route.ts` — DELETE (revoke)
8. Create `/app/(protected)/candidates/page.tsx`:
   - Candidate list with search, batch filter
   - "Import Candidates" (paste/upload emails or phones)
   - Batch management section
9. Create `/app/(protected)/assessments/[id]/assign/page.tsx`:
   - Assign to individuals (candidate picker) or batches
   - Assignment status table (Invited/Started/Submitted/Expired)
   - "Send Invitations" bulk action
   - Copy individual invite links
10. Create components:
    - `components/candidates/candidate-import.tsx`
    - `components/candidates/batch-manager.tsx`
    - `components/assessments/assignment-table.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Batch, BatchMember, AssessmentAssignment |
| Create | `services/candidates.ts` | Candidate + batch logic |
| Create | `services/assignments.ts` | Assignment logic |
| Create | `services/invitations.ts` | Email + SMS dispatch |
| Create | `lib/email.ts` | Transactional email wrapper |
| Create | `app/api/candidates/route.ts` | Candidate list |
| Create | `app/api/candidates/import/route.ts` | Bulk import |
| Create | `app/api/batches/route.ts` | Batch management |
| Create | `app/api/batches/[id]/members/route.ts` | Batch membership |
| Create | `app/api/assessments/[id]/assignments/route.ts` | Assign |
| Create | `app/api/assignments/[id]/invite/route.ts` | Send invite |
| Create | `app/api/assignments/[id]/route.ts` | Revoke |
| Create | `app/(protected)/candidates/page.tsx` | Candidate management |
| Create | `app/(protected)/assessments/[id]/assign/page.tsx` | Assignment page |
| Create | `components/candidates/*.tsx` | Candidate components |

## 7. Testing / Verification

- [ ] Import candidates by email list → User records created
- [ ] Import candidates by phone list → User records created
- [ ] Create batch → add candidates → members listed
- [ ] Assign assessment to individual → assignment + token created
- [ ] Assign assessment to batch → all members assigned
- [ ] Send email invitation → email received with unique link
- [ ] Send SMS invitation → SMS received (MSG91, DLT template)
- [ ] Assignment status shows "Invited"
- [ ] Revoke assignment → removed
- [ ] Duplicate assignment (same candidate + assessment) → prevented
- [ ] Copy invite link → resolves to correct token
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: candidate/batch/assignment model, invitation flow, token-based exam links
- Add to `docs/project-context.md`: Plan 13 completed, candidate management + assignment live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes
- Documentation updates: ~5 minutes

# Plan 032 — Company Profiles & Recruiter Onboarding

## 1. Objective

Build the company (recruiting organization) profile system and recruiter onboarding, establishing the employer side of the campus recruitment marketplace.

## 2. Scope

- Company profile model (distinct from College orgs)
- Company profile creation and management UI
- Recruiter onboarding into a company
- Company verification workflow (admin-approved)
- College–Company relationship model (which companies recruit at which colleges)
- Company public profile page (visible to students)

### Out of Scope

- Job postings (Plan 22)
- Application pipeline (Plan 24)
- Billing/subscription for companies (Sprint 4)
- ATS integrations (Sprint 6)

## 3. Prerequisites / Dependencies

- Sprint 1–2 complete
- Plan 03 (Organization model — `OrgType.COMPANY` already exists)
- Plan 07 (RBAC — RECRUITER role)
- Plan 09 (storage for company logos)

## 4. Technical Approach

The `Organization` model from Plan 03 already supports `OrgType.COMPANY`. This plan extends it with a `CompanyProfile` for employer-specific fields (industry, size, website, description, hiring focus) and builds the recruiter experience.

A `CollegeCompanyRelation` model captures which companies are approved to recruit at which colleges — the core of the campus marketplace. Relations can be initiated by either side and require mutual acceptance (or college-admin approval).

Company verification (by SuperAdmin) prevents fake employers from accessing student data.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum CompanyStatus {
     PENDING_VERIFICATION
     VERIFIED
     SUSPENDED
   }

   enum RelationStatus {
     REQUESTED
     APPROVED
     REJECTED
   }

   model CompanyProfile {
     id            String        @id @default(cuid())
     orgId         String        @unique
     industry      String?
     size          String?       // "1-50", "51-200", etc.
     website       String?
     description   String?       @db.Text
     hiringFocus   String[]      // e.g. ["SDE", "Data Science"]
     headquarters  String?
     status        CompanyStatus @default(PENDING_VERIFICATION)
     verifiedAt    DateTime?
     createdAt     DateTime      @default(now())
     updatedAt     DateTime      @updatedAt

     org           Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
   }

   model CollegeCompanyRelation {
     id            String          @id @default(cuid())
     collegeOrgId  String
     companyOrgId  String
     status        RelationStatus  @default(REQUESTED)
     initiatedBy   String          // "COLLEGE" | "COMPANY"
     requestedAt   DateTime        @default(now())
     respondedAt   DateTime?

     college       Organization    @relation("CollegeRelations", fields: [collegeOrgId], references: [id], onDelete: Cascade)
     company       Organization    @relation("CompanyRelations", fields: [companyOrgId], references: [id], onDelete: Cascade)

     @@unique([collegeOrgId, companyOrgId])
     @@index([collegeOrgId])
     @@index([companyOrgId])
   }
   ```
2. Add reverse relations on Organization
3. Run migration: `npx prisma migrate dev --name company_profiles`
4. Create `services/companies.ts`:
   - `createCompanyProfile(orgId, data)`
   - `updateCompanyProfile(orgId, data)`
   - `getCompanyProfile(orgId)` — public + private views
   - `verifyCompany(orgId, adminId)` — SuperAdmin action
   - `suspendCompany(orgId, reason)`
5. Create `services/college-company-relations.ts`:
   - `requestRelation(collegeOrgId, companyOrgId, initiatedBy)`
   - `respondToRelation(relationId, decision)` — approve/reject
   - `listCollegePartners(collegeOrgId)` — approved companies
   - `listCompanyColleges(companyOrgId)` — approved colleges
   - `listPendingRelations(orgId)`
6. Create company onboarding flow:
   - `/app/(protected)/company/onboarding/page.tsx` — multi-step: profile details → logo → hiring focus → submit for verification
7. Create `/app/(protected)/company/profile/page.tsx`:
   - Edit company profile (recruiter/company-admin only)
   - Verification status banner
8. Create `/app/(protected)/company/partners/page.tsx`:
   - List approved colleges
   - "Request Partnership" (search colleges)
   - Pending requests (incoming/outgoing)
9. Create college-side counterpart `/app/(protected)/partners/page.tsx`:
   - Colleges see companies wanting to recruit
   - Approve/reject company partnership requests
10. Create SuperAdmin verification `/app/(protected)/admin/companies/page.tsx`:
    - Pending company verifications
    - Approve/suspend actions
11. Create public company profile `/app/(protected)/companies/[orgId]/page.tsx`:
    - Student-visible: company info, hiring focus, open roles (linked in Plan 22)
12. Create components:
    - `components/companies/company-form.tsx`
    - `components/companies/partnership-request.tsx`
    - `components/companies/verification-panel.tsx`
13. Add role-aware nav items (Company section for recruiters, Partners for colleges)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | CompanyProfile, CollegeCompanyRelation |
| Create | `services/companies.ts` | Company logic |
| Create | `services/college-company-relations.ts` | Partnership logic |
| Create | `app/(protected)/company/onboarding/page.tsx` | Onboarding |
| Create | `app/(protected)/company/profile/page.tsx` | Profile management |
| Create | `app/(protected)/company/partners/page.tsx` | Company's colleges |
| Create | `app/(protected)/partners/page.tsx` | College's companies |
| Create | `app/(protected)/admin/companies/page.tsx` | Verification |
| Create | `app/(protected)/companies/[orgId]/page.tsx` | Public profile |
| Create | `app/api/companies/*/route.ts` | Company APIs |
| Create | `app/api/relations/*/route.ts` | Relation APIs |
| Create | `components/companies/*.tsx` | Company components |
| Modify | `constants/navigation.ts` | Company/Partner nav |

## 7. Testing / Verification

- [ ] Recruiter completes company onboarding → profile created, PENDING_VERIFICATION
- [ ] SuperAdmin verifies company → status VERIFIED
- [ ] Company requests partnership with college → REQUESTED
- [ ] College admin approves → APPROVED, appears in both partner lists
- [ ] College admin rejects → REJECTED
- [ ] College can initiate partnership with company too
- [ ] Unverified company blocked from student-facing actions
- [ ] Public company profile visible to students
- [ ] Recruiter can only edit their own company
- [ ] Cross-org: recruiter can't edit another company's profile
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: company profile model, college–company relation lifecycle, verification workflow
- Add to `docs/project-context.md`: Plan 21 completed, employer side established

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes
- Documentation updates: ~5 minutes

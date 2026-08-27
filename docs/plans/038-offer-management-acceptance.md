# Plan 038 — Offer Management & Acceptance

## 1. Objective

Build the offer lifecycle: recruiters extend offers to selected candidates, generate offer letters, and candidates accept/decline — closing the recruitment funnel with placement tracking.

## 2. Scope

- Offer model (terms, compensation, joining details)
- Offer letter generation (PDF)
- Offer extension to SELECTED candidates
- Candidate accept/decline flow
- Offer revision/withdrawal
- Placement records (for college placement stats)
- Offer status tracking for all parties

### Out of Scope

- E-signature integration (Sprint 6 — PDF + manual acceptance for now)
- Salary negotiation workflow (single revision supported)
- Onboarding beyond acceptance

## 3. Prerequisites / Dependencies

- Plan 24 complete (applications reaching SELECTED)
- Plan 20 (PDF generation infra reused)
- Plan 13 (notification/invitation infra)

## 4. Technical Approach

When an application reaches SELECTED (Plan 24), a recruiter can extend an `Offer` with terms (CTC, role, location, joining date). An offer letter PDF is generated (reusing Plan 20's PDF infra) with company branding.

The candidate receives the offer, reviews the letter, and accepts or declines within a response window. Acceptance creates a `Placement` record — the canonical "student X placed at company Y" fact that drives college placement statistics (surfaced in analytics, Plan 19, and reports, Plan 20).

Offers can be revised once (new version supersedes) or withdrawn before response.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum OfferStatus {
     DRAFT
     EXTENDED
     ACCEPTED
     DECLINED
     WITHDRAWN
     EXPIRED
   }

   model Offer {
     id            String      @id @default(cuid())
     applicationId String
     jobId         String
     userId        String
     companyOrgId  String
     status        OfferStatus @default(DRAFT)
     role          String
     ctc           Float
     joiningLocation String?
     joiningDate   DateTime?
     letterUrl     String?
     terms         String?     @db.Text
     version       Int         @default(1)
     respondBy     DateTime?
     extendedAt    DateTime?
     respondedAt   DateTime?
     createdById   String
     createdAt     DateTime    @default(now())

     user          User        @relation(fields: [userId], references: [id])

     @@index([applicationId])
     @@index([userId])
     @@index([companyOrgId])
   }

   model Placement {
     id            String    @id @default(cuid())
     offerId       String    @unique
     userId        String
     companyOrgId  String
     collegeOrgId  String
     role          String
     ctc           Float
     batchYear     Int?
     placedAt      DateTime  @default(now())

     user          User      @relation(fields: [userId], references: [id])

     @@index([collegeOrgId])
     @@index([companyOrgId])
     @@index([batchYear])
   }
   ```
2. Run migration: `npx prisma migrate dev --name offers_placements`
3. Create `services/offers.ts`:
   - `createOffer(applicationId, data)` — only if application SELECTED
   - `generateOfferLetter(offerId)` — PDF via Plan 20 infra (branded template)
   - `extendOffer(offerId)` — DRAFT → EXTENDED, notify candidate, set respondBy
   - `reviseOffer(offerId, data)` — new version, resets response
   - `withdrawOffer(offerId, reason)`
   - `respondToOffer(offerId, decision)` — candidate accept/decline
   - `expireStaleOffers()` — job/cron: mark EXPIRED past respondBy
4. Create `services/placements.ts`:
   - `createPlacement(offerId)` — on acceptance
   - `getCollegePlacementStats(collegeOrgId, batchYear)` — placed count, avg/high CTC, company breakdown
   - `getCompanyPlacements(companyOrgId)`
   - `getStudentPlacement(userId)`
5. Create offer letter PDF template `services/export/offer-letter.ts`:
   - Company logo/branding, candidate name, role, CTC, joining details, terms, date
6. Create API routes:
   - `/app/api/applications/[id]/offer/route.ts` — POST (create), GET
   - `/app/api/offers/[id]/route.ts` — GET, PATCH (revise)
   - `/app/api/offers/[id]/extend/route.ts` — POST
   - `/app/api/offers/[id]/withdraw/route.ts` — POST
   - `/app/api/offers/[id]/respond/route.ts` — POST (candidate)
   - `/app/api/offers/[id]/letter/route.ts` — GET (PDF download)
   - `/app/api/students/me/offers/route.ts` — GET
   - `/app/api/college/placements/route.ts` — GET (stats)
7. Create recruiter pages:
   - `/app/(protected)/jobs/[id]/offers/page.tsx` — offers for this job, statuses
   - Offer creation dialog from pipeline (Plan 24) SELECTED candidates
8. Create student pages:
   - `/app/(protected)/my-offers/page.tsx` — received offers, view letter, accept/decline
9. Create college pages:
   - `/app/(protected)/college/placements/page.tsx` — placement dashboard (counts, CTC stats, company-wise)
10. Create components:
    - `components/offers/offer-form.tsx`
    - `components/offers/offer-card.tsx`
    - `components/offers/offer-response.tsx` (accept/decline with confirmation)
    - `components/placements/placement-stats.tsx`
11. Integrate placement stats into analytics (Plan 19) and exports (Plan 20)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Offer, Placement |
| Create | `services/offers.ts` | Offer lifecycle |
| Create | `services/placements.ts` | Placement + stats |
| Create | `services/export/offer-letter.ts` | Offer letter PDF |
| Create | `app/api/applications/[id]/offer/route.ts` | Create offer |
| Create | `app/api/offers/[id]/*/route.ts` | Offer actions |
| Create | `app/api/students/me/offers/route.ts` | Student offers |
| Create | `app/api/college/placements/route.ts` | Placement stats |
| Create | `app/(protected)/jobs/[id]/offers/page.tsx` | Recruiter offers |
| Create | `app/(protected)/my-offers/page.tsx` | Student offers |
| Create | `app/(protected)/college/placements/page.tsx` | Placement dashboard |
| Create | `components/offers/*.tsx`, `components/placements/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Create offer for SELECTED candidate → DRAFT
- [ ] Create offer for non-SELECTED → blocked
- [ ] Generate offer letter → branded PDF with correct details
- [ ] Extend offer → EXTENDED, candidate notified, respondBy set
- [ ] Candidate accepts → ACCEPTED, Placement created
- [ ] Candidate declines → DECLINED, no placement
- [ ] Revise offer → new version, response reset
- [ ] Withdraw offer before response → WITHDRAWN
- [ ] Offer past respondBy → EXPIRED
- [ ] Placement appears in college placement stats
- [ ] CTC stats (avg, high) computed correctly
- [ ] Company-wise placement breakdown correct
- [ ] Student sees offer + can download letter
- [ ] Recruiter can't offer on another company's application
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: offer lifecycle, placement model, offer letter generation, placement stats feeding analytics
- Add to `docs/project-context.md`: Plan 27 completed, offer + placement live — recruitment funnel complete end to end

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~25 minutes (full offer lifecycle, placement stats)
- Documentation updates: ~5 minutes

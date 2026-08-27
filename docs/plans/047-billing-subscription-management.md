# Plan 047 — Billing & Subscription Management

## 1. Objective

Build subscription and billing management so the platform can monetize: plan tiers, usage limits, subscription lifecycle, invoicing, and payment integration suited to the Indian market.

## 2. Scope

- Plan tier model (Free, Pro, Enterprise) with feature/usage limits
- Subscription lifecycle (trial, active, past-due, cancelled)
- Usage metering and limit enforcement
- Payment integration (Razorpay — India-appropriate)
- Invoice generation
- Billing admin UI + SuperAdmin oversight

### Out of Scope

- Complex proration/metered billing (simple tier + seat model)
- Multi-currency (INR focus)
- Tax compliance automation beyond GST basics (consult accountant)

## 3. Prerequisites / Dependencies

- Plan 35 (org settings — billing is org-scoped)
- Plan 34 (async — invoice generation, webhook processing)
- Plan 31 (notifications — billing alerts)
- Plan 20 (PDF — invoices)

## 4. Technical Approach

Razorpay is the natural payment gateway for the Indian market (UPI, cards, netbanking, GST invoicing). The model: each org has a `Subscription` on a `Plan` tier. Plans define limits (assessments/month, candidates, team seats, storage, proctoring). Usage is metered; limits are enforced at action time with clear upgrade prompts.

Razorpay handles payment collection and recurring billing; webhooks keep our subscription status in sync (processed via Plan 34's queue for reliability). Invoices are generated as PDFs (Plan 20 infra) with GST fields.

Free tier lets colleges start with no friction (aligned with the go-to-market of getting into colleges), with paid tiers unlocking scale/features.

## 5. Implementation Steps

1. Add config: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` (Plan 02 env schema)
2. Add Prisma models:
   ```prisma
   enum PlanTier {
     FREE
     PRO
     ENTERPRISE
   }

   enum SubscriptionStatus {
     TRIALING
     ACTIVE
     PAST_DUE
     CANCELLED
     EXPIRED
   }

   model Plan {
     id            String    @id @default(cuid())
     tier          PlanTier  @unique
     name          String
     priceMonthly  Float     // INR
     priceYearly   Float
     limits        Json      // { assessmentsPerMonth, candidates, seats, storageGb, proctoring }
     features      String[]
     active        Boolean   @default(true)

     subscriptions Subscription[]
   }

   model Subscription {
     id                String             @id @default(cuid())
     orgId             String             @unique
     planId            String
     status            SubscriptionStatus @default(TRIALING)
     billingCycle      String             // "monthly" | "yearly"
     razorpaySubId     String?
     razorpayCustomerId String?
     trialEndsAt       DateTime?
     currentPeriodEnd  DateTime?
     cancelAtPeriodEnd Boolean            @default(false)
     createdAt         DateTime           @default(now())

     org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
     plan              Plan         @relation(fields: [planId], references: [id])
     invoices          Invoice[]
     usageRecords      UsageRecord[]

     @@index([status])
   }

   model UsageRecord {
     id             String    @id @default(cuid())
     subscriptionId String
     metric         String    // "assessments", "candidates", "storage"
     value          Int
     periodStart    DateTime
     periodEnd      DateTime

     subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

     @@index([subscriptionId, metric])
   }

   model Invoice {
     id             String    @id @default(cuid())
     subscriptionId String
     orgId          String
     amount         Float
     gstAmount      Float     @default(0)
     status         String    // "paid", "pending", "failed"
     razorpayInvoiceId String?
     pdfUrl         String?
     issuedAt       DateTime  @default(now())
     paidAt         DateTime?

     subscription   Subscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)

     @@index([orgId])
   }
   ```
3. Run migration: `npx prisma migrate dev --name billing`
4. Seed plans: `services/billing/seed-plans.ts` (Free/Pro/Enterprise with INR pricing + limits)
5. Create `lib/razorpay.ts` — Razorpay API wrapper (customers, subscriptions, orders, webhook verification)
6. Create `services/billing/subscriptions.ts`:
   - `startTrial(orgId)` — auto Free/trial on org creation
   - `subscribe(orgId, planId, cycle)` — create Razorpay subscription, return checkout
   - `changePlan(orgId, planId)` — upgrade/downgrade
   - `cancelSubscription(orgId, atPeriodEnd)`
   - `handleWebhook(event)` — sync status from Razorpay (queued via Plan 34)
7. Create `services/billing/usage.ts`:
   - `recordUsage(orgId, metric, delta)` — called from feature actions
   - `checkLimit(orgId, metric)` — returns `{ allowed, current, limit }`
   - `enforceLimit(orgId, metric)` — throws with upgrade prompt if exceeded
   - Wire limits into: assessment creation (Plan 12), candidate import (Plan 13), team invites (Plan 35), storage (Plan 09)
8. Create `services/billing/invoices.ts`:
   - `generateInvoice(subscriptionId, period)` — PDF with GST (Plan 20 infra, async via Plan 34)
   - `listInvoices(orgId)`
9. Create API routes:
   - `/app/api/billing/plans/route.ts` — GET (public plan list)
   - `/app/api/billing/subscribe/route.ts` — POST (checkout)
   - `/app/api/billing/subscription/route.ts` — GET, PATCH (change/cancel)
   - `/app/api/billing/usage/route.ts` — GET
   - `/app/api/billing/invoices/route.ts` — GET
   - `/app/api/billing/invoices/[id]/pdf/route.ts` — GET
   - `/app/api/webhooks/razorpay/route.ts` — POST (signature-verified, enqueues processing)
10. Create billing pages:
    - `/app/(protected)/settings/billing/page.tsx` — current plan, usage meters, upgrade/downgrade, invoices
    - `/app/(protected)/pricing/page.tsx` — plan comparison + subscribe
11. Create SuperAdmin oversight:
    - `/app/(protected)/admin/subscriptions/page.tsx` — all org subscriptions, MRR, status breakdown
12. Create components:
    - `components/billing/plan-comparison.tsx`
    - `components/billing/usage-meters.tsx`
    - `components/billing/upgrade-prompt.tsx` (shown when limits hit)
    - `components/billing/invoice-list.tsx`
    - `components/billing/checkout.tsx` (Razorpay integration)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `lib/env.ts` | Razorpay keys |
| Modify | `prisma/schema.prisma` | Plan, Subscription, Usage, Invoice |
| Create | `lib/razorpay.ts` | Razorpay wrapper |
| Create | `services/billing/*.ts` | Billing logic |
| Modify | `services/assessments.ts`, `candidates.ts`, `org-members.ts` | Limit enforcement |
| Create | `app/api/billing/*/route.ts` | Billing APIs |
| Create | `app/api/webhooks/razorpay/route.ts` | Webhook |
| Create | `app/(protected)/settings/billing/page.tsx` | Billing page |
| Create | `app/(protected)/pricing/page.tsx` | Pricing |
| Create | `app/(protected)/admin/subscriptions/page.tsx` | Admin oversight |
| Create | `components/billing/*.tsx` | Billing UI |

## 7. Testing / Verification

- [ ] New org → Free/trial subscription auto-created
- [ ] Plan list shows tiers with INR pricing + limits
- [ ] Subscribe to Pro → Razorpay checkout → active subscription
- [ ] Webhook updates status on payment (test mode)
- [ ] Usage recorded on assessment creation
- [ ] Hit Free limit → action blocked with upgrade prompt
- [ ] Upgrade → limit raised, action succeeds
- [ ] Downgrade → takes effect at period end
- [ ] Cancel → cancelAtPeriodEnd set, access until period end
- [ ] Invoice generated with GST fields → downloadable PDF
- [ ] Past-due handling on failed payment
- [ ] SuperAdmin sees all subscriptions + MRR
- [ ] Webhook signature verification rejects forged calls
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: billing model, Razorpay integration, usage metering + limit enforcement points, webhook via queue
- Add to `CLAUDE.md`: "Enforce limits via `enforceLimit()` at action points; never bypass"
- Add to `docs/project-context.md`: Plan 36 completed, billing live — platform monetizable

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~30 minutes (Razorpay test mode, limits, webhooks)
- Documentation updates: ~5 minutes

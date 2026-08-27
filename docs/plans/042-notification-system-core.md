# Plan 042 — Notification System Core

## 1. Objective

Build a centralized notification system that delivers in-app, email, and SMS notifications across all platform events, replacing the ad-hoc invitation dispatch from earlier sprints with a unified, preference-aware engine.

## 2. Scope

- Notification model and delivery infrastructure
- Multi-channel delivery (in-app, email, SMS via MSG91)
- Notification templates with variable interpolation
- User notification preferences (per-channel, per-category opt-in/out)
- In-app notification center (bell icon, unread badge)
- Notification triggering API for other services

### Out of Scope

- Real-time push (websockets/SSE) — Plan 32 adds real-time delivery
- Digest/batched notifications (Sprint 5)
- Rich notification analytics (future)

## 3. Prerequisites / Dependencies

- Sprint 1–3 complete
- Plan 05 (MSG91 for SMS)
- Plan 13 (email infra — `lib/email.ts`)
- Plan 08 (UI for notification center)

## 4. Technical Approach

A central `Notification` model records every notification with its target user, category, channels, and delivery status. A `notify()` service function is the single entry point — other services call it instead of sending emails/SMS directly.

Templates live in code (typed, versioned) with variable interpolation. Before delivery, the system checks the user's `NotificationPreference` for that category/channel. In-app notifications always persist; email/SMS respect preferences.

Delivery is synchronous in this plan (fire on trigger); Plan 34's job queue will make it async for reliability at scale. This plan establishes the model and channels; Plan 32 adds real-time in-app delivery.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum NotificationChannel {
     IN_APP
     EMAIL
     SMS
   }

   enum NotificationCategory {
     ASSESSMENT      // invited, results ready
     APPLICATION     // status changes, advancement
     INTERVIEW       // scheduled, reminder
     OFFER           // received, expiring
     DRIVE           // announced, registration
     SYSTEM          // account, security
   }

   enum DeliveryStatus {
     PENDING
     SENT
     FAILED
     SKIPPED         // preference opt-out
   }

   model Notification {
     id            String                @id @default(cuid())
     userId        String
     category      NotificationCategory
     title         String
     body          String                @db.Text
     actionUrl     String?
     entityType    String?
     entityId      String?
     isRead        Boolean               @default(false)
     readAt        DateTime?
     createdAt     DateTime              @default(now())

     user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
     deliveries    NotificationDelivery[]

     @@index([userId, isRead])
     @@index([createdAt])
   }

   model NotificationDelivery {
     id             String              @id @default(cuid())
     notificationId String
     channel        NotificationChannel
     status         DeliveryStatus      @default(PENDING)
     error          String?
     sentAt         DateTime?

     notification   Notification        @relation(fields: [notificationId], references: [id], onDelete: Cascade)

     @@index([notificationId])
   }

   model NotificationPreference {
     id            String                @id @default(cuid())
     userId        String
     category      NotificationCategory
     inApp         Boolean               @default(true)
     email         Boolean               @default(true)
     sms           Boolean               @default(false)

     user          User                  @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([userId, category])
   }
   ```
2. Run migration: `npx prisma migrate dev --name notifications`
3. Create `lib/notifications/templates.ts`:
   - Typed template registry keyed by event (e.g., `ASSESSMENT_INVITED`, `OFFER_RECEIVED`)
   - Each template: title, body (in-app), email subject/body, SMS text (DLT-compliant), variable schema
4. Create `services/notifications.ts`:
   - `notify(userId, event, variables, channels?)` — main entry:
     - Resolve template
     - Check preferences per channel
     - Create Notification + Delivery records
     - Dispatch to enabled channels (in-app always persists; email via `lib/email`; SMS via MSG91)
   - `notifyMany(userIds, event, variables)` — bulk
   - `markRead(notificationId)` / `markAllRead(userId)`
   - `listNotifications(userId, filters)` — paginated
   - `getUnreadCount(userId)`
   - `getPreferences(userId)` / `updatePreferences(userId, prefs)`
5. Refactor existing dispatch to use `notify()`:
   - Plan 13 invitations → `notify(..., 'ASSESSMENT_INVITED', ...)`
   - Plan 24 status changes, Plan 26 interviews, Plan 27 offers, Plan 28 drives
6. Create API routes:
   - `/app/api/notifications/route.ts` — GET (list)
   - `/app/api/notifications/[id]/read/route.ts` — POST
   - `/app/api/notifications/read-all/route.ts` — POST
   - `/app/api/notifications/unread-count/route.ts` — GET
   - `/app/api/notifications/preferences/route.ts` — GET, PATCH
7. Create in-app notification center:
   - `components/notifications/notification-bell.tsx` — top bar bell + unread badge
   - `components/notifications/notification-dropdown.tsx` — recent notifications list
   - `components/notifications/notification-item.tsx`
   - Add bell to top bar (Plan 08)
8. Create `/app/(protected)/notifications/page.tsx` — full notification history
9. Create `/app/(protected)/settings/notifications/page.tsx` — preference management (per category, per channel)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | Notification, Delivery, Preference |
| Create | `lib/notifications/templates.ts` | Template registry |
| Create | `services/notifications.ts` | Notification engine |
| Modify | `services/invitations.ts`, `applications.ts`, `interviews.ts`, `offers.ts`, `drives.ts` | Use notify() |
| Create | `app/api/notifications/*/route.ts` | Notification APIs |
| Create | `components/notifications/*.tsx` | Notification UI |
| Modify | `components/layout/top-bar.tsx` | Add bell |
| Create | `app/(protected)/notifications/page.tsx` | History |
| Create | `app/(protected)/settings/notifications/page.tsx` | Preferences |

## 7. Testing / Verification

- [ ] Assessment invitation → in-app + email notification created
- [ ] Notification bell shows unread badge
- [ ] Click notification → marks read, navigates to actionUrl
- [ ] Mark all read → badge clears
- [ ] User opts out of OFFER emails → offer email skipped, in-app still delivered
- [ ] SMS notification (opt-in category) → MSG91 DLT template sent
- [ ] Delivery status tracked (SENT / FAILED / SKIPPED)
- [ ] Failed email → delivery marked FAILED, in-app unaffected
- [ ] Preference page saves per-category, per-channel settings
- [ ] Notification history paginates
- [ ] Existing flows (invitations, status changes) now route through notify()
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: "All notifications go through `notify()` — never send email/SMS directly from feature services"
- Add to `CLAUDE.md`: template registry pattern, preference checking, delivery tracking
- Add to `docs/project-context.md`: Plan 31 completed, unified notifications live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes (channels, preferences, refactored flows)
- Documentation updates: ~5 minutes

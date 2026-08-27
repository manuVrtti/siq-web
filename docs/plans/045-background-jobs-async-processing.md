# Plan 045 — Background Jobs & Async Processing

## 1. Objective

Introduce a background job queue so heavy or slow operations — grading at scale, bulk notifications, exports, resume parsing, report generation — run asynchronously and reliably instead of blocking request/response cycles.

## 2. Scope

- Job queue infrastructure (Vercel-compatible)
- Job definitions for existing heavy operations
- Retry, backoff, and failure handling
- Scheduled/cron jobs (offer expiry, digests, cleanup)
- Job status tracking and admin visibility
- Migration of synchronous heavy work to async

### Out of Scope

- Distributed multi-worker orchestration (not needed at this scale)
- Complex DAG workflows (future)
- Real-time job progress streaming (basic status only)

## 3. Prerequisites / Dependencies

- Sprints 1–3 complete + Plans 31–33
- Plan 16 (grading — becomes async-capable)
- Plan 20 (exports/reports — become async)
- Plan 31 (bulk notifications — become async)
- Vercel hosting (serverless constraints inform the choice)

## 4. Technical Approach

Vercel's serverless model rules out always-on worker processes. The pragmatic choice is a queue that works with serverless: **Vercel Cron + a database-backed job table**, or a Vercel-native queue. To stay within the existing stack and avoid new vendors, use a **Postgres-backed job queue** (jobs table + Vercel Cron triggering a processing endpoint) — durable, no new infrastructure, Prisma-managed.

Jobs are enqueued (row inserted), a Vercel Cron endpoint polls and processes pending jobs in batches with locking (SELECT ... FOR UPDATE SKIP LOCKED via `$queryRaw`), retries with exponential backoff, and marks terminal status. Time-sensitive triggers (offer expiry) use scheduled crons.

This keeps everything in the sanctioned stack (Postgres + Vercel) while making heavy work reliable.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum JobStatus2 {
     PENDING
     PROCESSING
     COMPLETED
     FAILED
     DEAD        // exhausted retries
   }

   model BackgroundJob {
     id            String    @id @default(cuid())
     type          String    // "grade_attempt", "send_bulk_notifications", "generate_export", etc.
     payload       Json
     status        JobStatus2 @default(PENDING)
     attempts      Int       @default(0)
     maxAttempts   Int       @default(3)
     runAfter      DateTime  @default(now())   // for backoff / scheduling
     lockedAt      DateTime?
     lockedBy      String?
     lastError     String?   @db.Text
     result        Json?
     createdAt     DateTime  @default(now())
     completedAt   DateTime?

     @@index([status, runAfter])
     @@index([type])
   }
   ```
2. Run migration: `npx prisma migrate dev --name background_jobs`
3. Create `lib/jobs/queue.ts`:
   - `enqueue(type, payload, opts?)` — insert job
   - `claimBatch(limit)` — `$queryRaw` SELECT ... FOR UPDATE SKIP LOCKED, mark PROCESSING
   - `complete(jobId, result)` / `fail(jobId, error)` — with backoff (runAfter = now + 2^attempts min), DEAD after maxAttempts
4. Create `lib/jobs/handlers.ts`:
   - Handler registry mapping job type → async function
   - Handlers: `grade_attempt`, `send_bulk_notifications`, `generate_export`, `generate_report`, `parse_resume`, `generate_placement_report`
5. Create processing endpoint:
   - `/app/api/jobs/process/route.ts` — claims a batch, runs handlers, updates status
   - Secured (cron secret header) — not publicly triggerable
6. Configure Vercel Cron (`vercel.json`):
   - Process queue every minute: `/api/jobs/process`
   - Scheduled jobs:
     - `/api/cron/expire-offers` (Plan 27) — hourly
     - `/api/cron/expire-assignments` — hourly
     - `/api/cron/cleanup` — daily (old sessions, temp files)
7. Create scheduled job endpoints:
   - `/app/api/cron/expire-offers/route.ts`
   - `/app/api/cron/expire-assignments/route.ts`
   - `/app/api/cron/cleanup/route.ts`
8. Migrate heavy operations to async:
   - Plan 16 grading: `submitAttempt` enqueues `grade_attempt` (fast submit, async grade) — keep sync path for single MCQ-only as fallback
   - Plan 20 exports/reports: enqueue, notify user when ready (via Plan 31), provide download when complete
   - Plan 31 bulk notifications: `notifyMany` enqueues `send_bulk_notifications`
   - Plan 25 resume parsing: enqueue `parse_resume` on upload
9. Create admin visibility:
   - `/app/(protected)/admin/jobs/page.tsx` — job queue monitor (pending/processing/failed/dead counts, recent failures, retry action)
   - `/app/api/admin/jobs/route.ts` — GET, retry dead jobs
10. Update UI for async results:
    - Export/report buttons → "Generating... you'll be notified" → notification + download link when done
    - `components/jobs/async-task-status.tsx` — optional inline status poll

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | BackgroundJob |
| Create | `lib/jobs/queue.ts` | Queue primitives |
| Create | `lib/jobs/handlers.ts` | Job handlers |
| Create | `app/api/jobs/process/route.ts` | Processor (cron) |
| Create | `app/api/cron/*/route.ts` | Scheduled jobs |
| Modify | `vercel.json` | Cron config |
| Modify | `services/grading.ts` | Async grading |
| Modify | `services/export/*`, `services/notifications.ts`, `services/resume.ts` | Enqueue heavy work |
| Create | `app/(protected)/admin/jobs/page.tsx` | Queue monitor |
| Create | `app/api/admin/jobs/route.ts` | Admin job API |
| Create | `components/jobs/async-task-status.tsx` | Status UI |

## 7. Testing / Verification

- [ ] Enqueue job → row created PENDING
- [ ] Cron processor claims + runs job → COMPLETED
- [ ] Failing job retries with backoff (runAfter increases)
- [ ] Job exhausts retries → DEAD
- [ ] Concurrent processors don't double-process (SKIP LOCKED works)
- [ ] Large assessment submit → grading runs async, result appears shortly after
- [ ] Bulk notification (100 users) → processed async, all delivered
- [ ] Export → "generating" → notification + download when ready
- [ ] Resume parse runs async on upload
- [ ] Offer expiry cron → stale offers marked EXPIRED
- [ ] Cleanup cron runs without error
- [ ] Admin monitor shows queue state; retry dead job works
- [ ] Process endpoint rejects unauthenticated calls (cron secret)
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: Postgres-backed queue rationale (serverless-compatible), enqueue pattern, cron config, handler registry
- Add to `CLAUDE.md`: "Heavy work (grading, exports, bulk notify, parsing) is enqueued, not run inline"
- Add to `docs/project-context.md`: Plan 34 completed, async processing live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (queue, retries, concurrency, crons)
- Documentation updates: ~5 minutes

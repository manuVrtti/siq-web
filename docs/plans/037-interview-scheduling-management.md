# Plan 037 — Interview Scheduling & Management

## 1. Objective

Build interview scheduling for interview-type hiring rounds: slot management, candidate booking, interviewer assignment, and feedback capture that feeds back into the application pipeline.

## 2. Scope

- Interview slot model (availability, capacity)
- Interviewer assignment (recruiters/panel members)
- Candidate scheduling (self-book or assigned)
- Interview modes (in-person, video link)
- Structured feedback/scorecards
- Feedback-driven advancement (into Plan 24 pipeline)
- Calendar view for recruiters and students

### Out of Scope

- Built-in video conferencing (link to external — Google Meet/Zoom URL)
- Rich notifications (Sprint 4 — basic here)
- Panel voting/consensus logic beyond aggregate scores

## 3. Prerequisites / Dependencies

- Plan 23 complete (INTERVIEW round type)
- Plan 24 complete (application pipeline — interviews advance candidates)
- Plan 13 (invitation infra reused for scheduling notifications)

## 4. Technical Approach

For INTERVIEW-type rounds, recruiters create `InterviewSlot`s (time windows with capacity and assigned interviewers). Candidates in that round are either auto-assigned or self-book an available slot, creating an `InterviewBooking`.

After the interview, interviewers submit a `Scorecard` (structured criteria + overall recommendation). The aggregate feeds the round outcome (Plan 24), where the recruiter advances or rejects.

Interview mode stores a location (in-person) or a video link (recruiter-provided). No native video — we link out.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum InterviewMode {
     IN_PERSON
     VIDEO
   }

   enum BookingStatus {
     SCHEDULED
     COMPLETED
     NO_SHOW
     CANCELLED
   }

   enum Recommendation {
     STRONG_YES
     YES
     NEUTRAL
     NO
     STRONG_NO
   }

   model InterviewSlot {
     id            String        @id @default(cuid())
     roundId       String
     jobId         String
     startAt       DateTime
     endAt         DateTime
     mode          InterviewMode @default(VIDEO)
     location      String?
     videoLink     String?
     capacity      Int           @default(1)
     createdById   String
     createdAt     DateTime      @default(now())

     interviewers  SlotInterviewer[]
     bookings      InterviewBooking[]

     @@index([roundId])
     @@index([jobId])
   }

   model SlotInterviewer {
     slotId        String
     userId        String

     slot          InterviewSlot @relation(fields: [slotId], references: [id], onDelete: Cascade)

     @@id([slotId, userId])
   }

   model InterviewBooking {
     id            String        @id @default(cuid())
     slotId        String
     applicationId String
     userId        String
     status        BookingStatus @default(SCHEDULED)
     bookedAt      DateTime      @default(now())

     slot          InterviewSlot @relation(fields: [slotId], references: [id], onDelete: Cascade)
     scorecards    Scorecard[]

     @@unique([slotId, applicationId])
     @@index([applicationId])
   }

   model Scorecard {
     id            String        @id @default(cuid())
     bookingId     String
     interviewerId String
     criteria      Json          // [{ name, score, maxScore }]
     overallScore  Float
     recommendation Recommendation
     comments      String?       @db.Text
     submittedAt   DateTime      @default(now())

     booking       InterviewBooking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

     @@index([bookingId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name interviews`
3. Create `services/interviews.ts`:
   - `createSlots(roundId, slots[])` — bulk slot creation
   - `assignInterviewers(slotId, userIds)`
   - `listSlots(roundId)` — with availability
   - `bookSlot(slotId, applicationId)` — capacity check
   - `autoAssignSlots(roundId)` — distribute candidates to open slots
   - `cancelBooking(bookingId)` / `markNoShow` / `markCompleted`
4. Create `services/scorecards.ts`:
   - `submitScorecard(bookingId, interviewerId, data)`
   - `getAggregateScore(bookingId)` — average across interviewers
   - `finalizeInterviewOutcome(applicationId, roundId)` — feeds Plan 24 round outcome
5. Wire into Plan 24: interview round outcome uses scorecard aggregate; recruiter advances/rejects with context
6. Create API routes:
   - `/app/api/jobs/[id]/rounds/[roundId]/slots/route.ts` — GET, POST
   - `/app/api/slots/[id]/interviewers/route.ts` — POST, DELETE
   - `/app/api/slots/[id]/book/route.ts` — POST
   - `/app/api/bookings/[id]/route.ts` — PATCH (status)
   - `/app/api/bookings/[id]/scorecard/route.ts` — POST, GET
   - `/app/api/students/me/interviews/route.ts` — GET
7. Create recruiter pages:
   - `/app/(protected)/jobs/[id]/rounds/[roundId]/interviews/page.tsx` — slot management, interviewer assignment, booking overview
   - `/app/(protected)/interviews/page.tsx` — interviewer's scheduled interviews (calendar)
   - `/app/(protected)/interviews/[bookingId]/scorecard/page.tsx` — submit feedback
8. Create student pages:
   - `/app/(protected)/my-interviews/page.tsx` — upcoming interviews, self-book available slots, video links
9. Create components:
   - `components/interviews/slot-creator.tsx`
   - `components/interviews/slot-picker.tsx` (student booking)
   - `components/interviews/interview-calendar.tsx`
   - `components/interviews/scorecard-form.tsx`
   - `components/interviews/booking-overview.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | InterviewSlot, Booking, Scorecard |
| Create | `services/interviews.ts` | Scheduling logic |
| Create | `services/scorecards.ts` | Feedback logic |
| Modify | `services/applications.ts` | Interview outcome integration |
| Create | `app/api/jobs/[id]/rounds/[roundId]/slots/route.ts` | Slots |
| Create | `app/api/slots/[id]/*/route.ts` | Slot actions |
| Create | `app/api/bookings/[id]/*/route.ts` | Bookings + scorecards |
| Create | `app/api/students/me/interviews/route.ts` | Student interviews |
| Create | `app/(protected)/jobs/[id]/rounds/[roundId]/interviews/page.tsx` | Slot management |
| Create | `app/(protected)/interviews/page.tsx` | Interviewer calendar |
| Create | `app/(protected)/interviews/[bookingId]/scorecard/page.tsx` | Scorecard |
| Create | `app/(protected)/my-interviews/page.tsx` | Student interviews |
| Create | `components/interviews/*.tsx` | Interview components |

## 7. Testing / Verification

- [ ] Recruiter creates interview slots for a round
- [ ] Assign interviewers to slots
- [ ] Student self-books an available slot → booking created
- [ ] Slot at capacity → no longer bookable
- [ ] Auto-assign distributes candidates to slots
- [ ] Video link shown to student for VIDEO mode
- [ ] Interviewer sees scheduled interviews in calendar
- [ ] Interviewer submits scorecard → aggregate computed
- [ ] Multiple interviewers → scores averaged
- [ ] Interview outcome feeds pipeline → recruiter advances/rejects
- [ ] Mark no-show → status updated
- [ ] Cancel booking → slot frees up
- [ ] Student can't book slots for jobs they're not in
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: interview scheduling model, slot/booking/scorecard flow, feedback → pipeline integration
- Add to `docs/project-context.md`: Plan 26 completed, interview scheduling live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes
- Documentation updates: ~5 minutes

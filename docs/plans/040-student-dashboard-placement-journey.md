# Plan 040 — Student Dashboard & Placement Journey

## 1. Objective

Build a unified student experience that ties together everything from Sprint 3 — opportunities, applications, assessments, interviews, offers, and drives — into a single coherent placement journey with a personalized dashboard.

## 2. Scope

- Student home dashboard (personalized overview)
- Unified activity timeline (application journey)
- Action center (pending tasks: assessments to take, interviews to book, offers to respond to)
- Placement readiness indicators
- Profile completeness prompts
- Consolidated notifications summary (foundation for Sprint 4)

### Out of Scope

- Rich real-time notifications (Sprint 4)
- Career recommendations / AI guidance (Sprint 6)
- Peer comparison / leaderboards

## 3. Prerequisites / Dependencies

- Plans 22–28 complete (all student-facing recruitment features)
- Plan 16 (results)
- Plan 08 (UI foundation)

## 4. Technical Approach

This plan is primarily aggregation and UX — it stitches existing data into one experience rather than introducing much new schema. A dashboard service queries across applications, assignments, interviews, offers, and drives to build a personalized view.

The centerpiece is an "action center" that surfaces what the student needs to do next (pending assessments, unbooked interviews, unanswered offers), reducing the risk of students missing time-sensitive placement steps. A journey timeline shows their progress across all applications.

## 5. Implementation Steps

1. (Minimal schema) Add a lightweight activity/event log for the timeline (optional — can derive from existing timestamps):
   ```prisma
   model StudentActivity {
     id          String    @id @default(cuid())
     userId      String
     type        String    // "applied", "assessment_completed", "interview_scheduled", "offer_received", etc.
     title       String
     description String?
     entityType  String?
     entityId    String?
     createdAt   DateTime  @default(now())

     user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@index([userId])
     @@index([createdAt])
   }
   ```
2. Run migration: `npx prisma migrate dev --name student_activity`
3. Create `services/student-dashboard.ts`:
   - `getDashboardData(userId)` — aggregate:
     - Active applications (count + by stage)
     - Pending actions (assessments due, interviews to book/attend, offers to respond)
     - Recent results
     - Open opportunities (eligible, not yet applied)
     - Upcoming drives
     - Offers received (count, pending)
   - `getActionCenter(userId)` — prioritized pending tasks with deadlines
   - `getJourneyTimeline(userId)` — chronological activity across all applications
   - `getPlacementReadiness(userId)` — profile completeness, resume uploaded, skills added, assessments practice-taken
4. Create `services/student-activity.ts`:
   - `logActivity(userId, type, data)` — called from other services (apply, submit, book, offer response)
   - Wire into: applications (Plan 24), exam submit (Plan 15), interviews (Plan 26), offers (Plan 27), drives (Plan 28)
5. Create API routes:
   - `/app/api/students/me/dashboard/route.ts` — GET
   - `/app/api/students/me/actions/route.ts` — GET (action center)
   - `/app/api/students/me/timeline/route.ts` — GET
6. Rebuild `/app/(protected)/dashboard/page.tsx` for students (role-aware):
   - Welcome + placement readiness meter
   - Action center (prominent — what to do next)
   - Application summary cards (by stage)
   - Recommended opportunities (eligible, not applied)
   - Upcoming interviews + drives
   - Pending offers alert
   - Recent activity snippet
7. Create `/app/(protected)/journey/page.tsx`:
   - Full application journey timeline
   - Per-application drill-down (all rounds, results, interview feedback if shared, offer)
8. Ensure role-based dashboard routing:
   - Student → student dashboard (this plan)
   - Recruiter → recruiter dashboard (jobs, pipelines, offers — assemble from Sprint 3 data)
   - CollegeAdmin → placement overview (drives, placements, stats)
   - SuperAdmin → platform dashboard (Plan 19 platform view)
9. Create components:
   - `components/dashboard/action-center.tsx`
   - `components/dashboard/application-summary.tsx`
   - `components/dashboard/readiness-meter.tsx`
   - `components/dashboard/opportunity-suggestions.tsx`
   - `components/dashboard/upcoming-events.tsx`
   - `components/journey/journey-timeline.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | StudentActivity |
| Create | `services/student-dashboard.ts` | Dashboard aggregation |
| Create | `services/student-activity.ts` | Activity logging |
| Modify | `services/applications.ts`, `exam-session.ts`, `interviews.ts`, `offers.ts`, `drives.ts` | Log activities |
| Create | `app/api/students/me/dashboard/route.ts` | Dashboard API |
| Create | `app/api/students/me/actions/route.ts` | Action center |
| Create | `app/api/students/me/timeline/route.ts` | Timeline |
| Modify | `app/(protected)/dashboard/page.tsx` | Role-aware dashboards |
| Create | `app/(protected)/journey/page.tsx` | Journey timeline |
| Create | `components/dashboard/*.tsx`, `components/journey/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Student dashboard loads with personalized data
- [ ] Action center shows pending assessment to take
- [ ] Action center shows interview to book
- [ ] Action center shows unanswered offer (with deadline)
- [ ] Readiness meter reflects profile completeness (resume, skills)
- [ ] Recommended opportunities exclude already-applied jobs
- [ ] Upcoming interviews + drives shown correctly
- [ ] Journey timeline shows chronological activity
- [ ] Activity logged when student applies / submits / books / responds
- [ ] Recruiter sees recruiter dashboard (not student one)
- [ ] CollegeAdmin sees placement overview
- [ ] Empty states for new student with no activity
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: dashboard aggregation pattern, action center logic, activity logging hooks, role-based dashboard routing
- Add to `docs/project-context.md`: Plan 29 completed, unified student journey live

## 9. Estimated Effort

- Claude Code execution: ~60 minutes
- Manual testing: ~20 minutes
- Documentation updates: ~5 minutes

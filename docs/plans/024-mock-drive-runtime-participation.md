# Plan 024 — Mock Drive Runtime & Student Participation

## 1. Objective

Build the student-facing mock drive experience: registered students progress through drive rounds, take the linked assessments, get auto-shortlisted/eliminated by cutoffs, and see their drive journey — turning the drive config (Plan 23) into a lived placement simulation.

## 2. Scope

- Student drive participation flow (round-by-round)
- Auto-assignment into round assessments (reuse Sprint 2 assignment)
- Cutoff evaluation → mock shortlist/eliminate after each round
- Round progression (advance survivors to next round)
- Student drive journey view (rounds cleared, current status, results)
- Placement-cell live drive monitor (who's in which round)
- Drive completion + final shortlist

### Out of Scope

- Competency scoring/diagnostics (Plans 25a/25b — consumes this data)
- Rich dashboards (Plans 26–28)
- Real offers (Phase 2 — mock drives end at final shortlist)

## 3. Prerequisites / Dependencies

- Plan 23 (mock drive setup, registrations)
- Sprint 2 Plans 13, 15, 16, 17, 18 (assignment, exam runtime, grading, SEB, proctoring — all reused)

## 4. Technical Approach

When a drive round becomes active, each surviving registrant is auto-issued a Sprint 2 `AssessmentAssignment` for that round's assessment. Students take it through the existing exam runtime (SEB-enforced, proctored, graded) — no new exam code.

On grading completion, the cutoff evaluates: score ≥ cutoff → SHORTLISTED (advances), else ELIMINATED. This mirrors Sprint 3's auto-advancement (Plan 24-Sprint3) but simplified for the linear mock-drive funnel. The placement cell can also manually override outcomes.

The student sees a clear journey: "Round 1: Cleared (82%) → Round 2: In Progress → Round 3: Locked". This progression pressure is the pedagogical point of a mock drive.

## 5. Implementation Steps

1. Create `services/mock-drive-runtime.ts`:
   - `activateRound(driveId, roundOrder)` — placement cell opens a round:
     - For each non-eliminated registrant, create AssessmentAssignment (Plan 13) for the round's assessment
     - Create MockRoundResult (PENDING) linking the assignment
     - Notify students (via Plan 31 if built, else basic)
   - `evaluateRound(driveId, roundOrder)` — after assessments graded:
     - Pull each result's score (from Sprint 2 grading, Plan 16)
     - Apply cutoff → SHORTLISTED / ELIMINATED
     - Advance shortlisted `currentRound`, mark eliminated
   - `overrideOutcome(roundResultId, outcome, reason)` — manual placement-cell override
   - `getDriveStandings(driveId)` — count per round, shortlist/eliminated tallies
   - `completeDrive(driveId)` — finalize, produce final shortlist
2. Create `services/mock-drive-student.ts`:
   - `getStudentDriveJourney(userId, driveId)` — rounds with per-round status + score
   - `listStudentDrives(userId)` — active + past drives with current standing
   - `getPendingDriveActions(userId)` — rounds the student needs to take now
3. Hook grading completion (Sprint 2 Plan 16) → if the graded assignment belongs to a MockRoundResult with auto-cutoff, trigger evaluation (or batch-evaluate when placement cell closes the round)
4. Create API routes:
   - `/app/api/mock-drives/[id]/rounds/[order]/activate/route.ts` — POST (placement cell)
   - `/app/api/mock-drives/[id]/rounds/[order]/evaluate/route.ts` — POST
   - `/app/api/mock-drives/[id]/standings/route.ts` — GET (live monitor)
   - `/app/api/mock-drives/[id]/complete/route.ts` — POST
   - `/app/api/mock-round-results/[id]/override/route.ts` — POST
   - `/app/api/students/me/drives/route.ts` — GET
   - `/app/api/students/me/drives/[id]/journey/route.ts` — GET
5. Create student pages:
   - `/app/(protected)/my-drives/page.tsx` — student's drives, current standing, pending actions
   - `/app/(protected)/my-drives/[id]/page.tsx` — drive journey:
     - Round-by-round progress (cleared / in-progress / locked / eliminated)
     - "Take Assessment" for active round → deep-links to exam entry (Sprint 2 Plan 15, SEB flow)
     - Per-round score (once graded)
     - Final outcome when drive completes
6. Create placement-cell live monitor:
   - `/app/(protected)/mock-drives/[id]/monitor/page.tsx`:
     - Funnel: registered → round 1 survivors → round 2 survivors → final shortlist
     - Per-round activate/evaluate controls
     - Live standings table (student, current round, latest score, status)
     - Manual override actions
     - Complete drive button
7. Create components:
   - `components/mock-drives/student-journey.tsx`
   - `components/mock-drives/round-progress-tracker.tsx`
   - `components/mock-drives/live-funnel.tsx`
   - `components/mock-drives/standings-table.tsx`
   - `components/mock-drives/round-controls.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `services/mock-drive-runtime.ts` | Round activation + evaluation |
| Create | `services/mock-drive-student.ts` | Student journey |
| Modify | `services/grading.ts` (Sprint 2) | Hook mock-round evaluation |
| Create | `app/api/mock-drives/[id]/rounds/[order]/*/route.ts` | Round control |
| Create | `app/api/mock-drives/[id]/standings/route.ts` | Live monitor |
| Create | `app/api/mock-round-results/[id]/override/route.ts` | Override |
| Create | `app/api/students/me/drives/*/route.ts` | Student drive APIs |
| Create | `app/(protected)/my-drives/*` | Student pages |
| Create | `app/(protected)/mock-drives/[id]/monitor/page.tsx` | Live monitor |
| Create | `components/mock-drives/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Activate round 1 → all registrants get assessment assignments
- [ ] Student takes round 1 assessment via SEB exam runtime (Sprint 2 flow intact)
- [ ] Assessment graded → score flows to MockRoundResult
- [ ] Evaluate round → above-cutoff shortlisted, below eliminated
- [ ] Shortlisted students advance to round 2
- [ ] Eliminated students see "eliminated" status, can't take round 2
- [ ] Activate round 2 → only survivors get assignments
- [ ] Manual override → eliminated student reinstated
- [ ] Student journey shows cleared/in-progress/locked correctly
- [ ] Live monitor funnel accurate (registered → survivors per round)
- [ ] Complete drive → final shortlist produced
- [ ] Proctoring + SEB enforcement carry over from Sprint 2
- [ ] HOD monitors only drives for their department
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: mock drive runtime, round activate/evaluate cycle, cutoff → shortlist, reuse of Sprint 2 exam flow
- Add to `docs/project-context.md`: Phase 1 Plan 24 completed, students can run through mock drives end-to-end
- Note: **this is the data-generation engine** — every round result feeds the competency engine (Plan 25a)

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~30 minutes (full multi-round funnel, elimination, overrides)
- Documentation updates: ~5 minutes

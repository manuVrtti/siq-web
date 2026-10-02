# Plan 016b — Retake / Reappear: Staff Grant a Fresh Attempt

> Raised by SG on 2026-10-03: "give option to retest or reappear for a particular test to a particular
> student from the HOD and College Admin sections".

## 1. Objective

Let a College Admin (any student of the college), an HOD (students of their departments) or a Super
Admin give one student a fresh attempt at one test — e.g. after a technical problem — **without
losing the earlier attempt**, which stays as evidence ("replaced by a retake").

## 2. Scope

- "Allow retake" on the staff grade page, with a required reason.
- The earlier attempt is kept: answers, score, proctoring / integrity log, identity check. Its result is
  marked **Replaced by a retake** and drops out of every average, pass rate, analytics, ranking, export
  and the student's own result list.
- The student gets a notification; the test reappears in their Assessments; a proctored test asks for the
  identity check again.
- Mock-drive rounds: allowed while the round is still open — the student's round outcome goes back to
  pending and the new score decides it.
- Retake history on the grade page (who allowed it, when, why, link to the earlier attempt). Audited.

### Out of scope
- Bulk retakes (a whole batch) — later if needed.
- Automatic re-attempts by `maxAttempts` (still one attempt unless staff grant a retake).

## 3. Prerequisites

Plans 015 (attempts), 016 (grading/results), 018 / 018b (proctoring, identity), 023–025 (drives,
competency).

## 4. Technical Approach

Today an assignment has exactly one attempt (`ExamAttempt.assignmentId` unique) and one result. A retake:
1. Marks the current result `SUPERSEDED` (new `ResultStatus` value). Almost every aggregate already
   filters `status: 'GRADED' | 'PENDING_REVIEW'`, so superseded results drop out automatically; the few
   unfiltered lists get `status: { not: 'SUPERSEDED' }`.
2. Detaches the attempt from the assignment (`assignmentId` → null, `archivedAssignmentId` kept), and the
   identity check likewise — they stay linked to the attempt for review.
3. Resets the assignment to INVITED, so the normal start flow creates a new attempt.
4. Records an `AttemptRetake` row (who, why, which attempt / result).
5. Recomputes the student's competency for that test; resets an open drive round.

Refused when: the student is taking the test right now; the test window has closed (extend it first);
the drive round is already closed (use the round override instead); the student is outside the scope.

## 5. Implementation Steps

1. **Migration (additive):** `ResultStatus` += `SUPERSEDED`; `Result.supersededAt`;
   `ExamAttempt.assignmentId` nullable + `archivedAssignmentId`; `IdentityCheck.assignmentId` nullable +
   `attemptId`; new `AttemptRetake`.
2. Set `IdentityCheck.attemptId` when an attempt starts; integrity review reads identity by attempt.
3. `services/retake.ts`: `grantRetake(scope, resultId, reason, actorId)` + `listRetakes(assignment)`.
4. API `POST /api/results/[id]/retake` (College Admin / HOD / Super Admin), audited as `result.retake`.
5. Notification event `assessment.retake` to the student.
6. Filter superseded results out of the unfiltered lists (results list, exports, analytics lists,
   candidate history, student result list, onboarding counts).
7. UI: "Allow retake" button + reason dialog on the grade page; retake history; banner on an earlier
   attempt's grade page.

## 6. File Changes

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` + migration |
| Create | `src/services/retake.ts`, `src/app/api/results/[id]/retake/route.ts`, `src/components/results/retake-button.tsx` |
| Modify | `src/services/exam-session.ts`, `src/services/proctoring.ts`, `src/services/identity.ts` |
| Modify | result queries in `grading.ts`, `analytics/*`, `export/*`, `profile.ts`, `onboarding.ts`, `results/page.tsx` |
| Modify | grade page, notification event types, audit labels |

## 7. Testing / Verification

- [ ] College Admin grants a retake with a reason; student's test reopens; notification sent
- [ ] Earlier result shows "Replaced by a retake", is excluded from averages, lists, exports, student list
- [ ] New attempt: identity check again (proctored), new result counts; competency recomputed
- [ ] HOD: own department's student only; another department → 403; student → 403
- [ ] Refused while the student is mid-exam, after the window closed, after the drive round closed
- [ ] Drive round reset to pending; the new score decides the round
- [ ] Retake history + audit row; earlier attempt's integrity log still viewable
- [ ] All regression suites; typecheck, lint, build

## 8. Documentation Updates

`docs/roles-and-permissions.md`: who can grant retakes; what happens to the earlier attempt.

## 9. Estimated Effort

~1.5 hours implementation + tests; ~15 minutes manual test by SG.

# Plan 018b — Exam Integrity: Identity Check, Random Face Checks, Activity Log for Staff

> Follow-up to Plan 018 (proctoring). Raised by SG after the first end-to-end mock drive in the exam
> browser (2026-10-03). Decisions by SG: on-device face **recognition** + human review; first-time
> selfie is the primary ID photo (college / student uploads supported later); on mismatch the exam
> **continues and is flagged**.

## 1. Objective

Make every mock round and proctored test trustworthy for the college:

1. **Before the exam** — confirm the person at the camera is the registered student.
2. **During the exam** — re-check at random, unpredictable moments that the same single person is
   there.
3. **For staff** — show the College Admin / HOD, per student per test, everything that happened:
   identity result, random-check snapshots, tab / window switches, copy-paste, screenshot attempts,
   other faces. Students never see this.

## 2. Scope

- ID photo per student (first proctored exam's verified selfie becomes it).
- Pre-exam identity gate in the exam browser (3 tries; mismatch → continue + HIGH alert).
- Server-enforced: a proctored exam cannot start without the identity step.
- Random in-exam checks (presence + identity) replacing the fixed timer.
- Activity tracking on **every** exam (camera or not): tab / window switch, focus loss, fullscreen
  exit, copy / cut / paste and right-click (blocked + logged), screenshot-key attempts.
- Staff-only **Exam integrity** panel on the grade page; integrity badge per student per round in the
  mock-drive Live monitor.
- Mock-drive rounds require proctoring.

### Out of scope (next steps)

- Student-uploaded ID photo with approval, and college bulk upload of official photos (follow-up
  plan 018c; the data model below already supports both).
- Exam-browser events (blocked shortcuts, second monitor, OS-level screenshot) forwarded into the log —
  browser v1.0.2, separate PR in `siq-Secure-browser`.
- Liveness / anti-spoofing (holding up a photo) — Phase 2.

## 3. Prerequisites / Dependencies

- Plan 015 (exam runtime), 017 (exam browser gateway), 018 (proctoring session, flags, private
  `proctoring` bucket), 023–024 (mock drives).
- New package (approved by SG): `@vladmandic/face-api` (MIT) — on-device face detection, landmarks
  and 128-number face recognition. Model files (~7 MB) are self-hosted under `/public/models/face-api`
  so the exam browser needs no extra domain.

## 4. Technical Approach

**Two models, two jobs.**
- MediaPipe (existing) — fast, frequent *presence* checks: no face / more than one face.
- face-api (new) — *identity*: a 128-number face descriptor; two photos of the same person are within
  Euclidean distance ≈ 0.5. We use **match score = 1 − distance**, match when distance ≤ 0.55
  (constant, tunable in one place).
- All face maths runs on the student's computer. Only snapshots (for human review) and numbers are
  uploaded. No face descriptors are stored on the server.

**Identity check (before Start).** In the exam browser, a proctored test shows an identity step before
"Start exam":
1. Camera on → capture a live photo.
2. If the student has no ID photo yet → this photo becomes their ID photo (source `SELFIE`, approved) —
   outcome `ENROLLED`.
3. Else → load their ID photo (short-lived signed URL), compare on-device. Up to 3 tries.
   `MATCHED`, or after 3 failures `MISMATCH` (exam continues; HIGH alert for staff).
4. The live photo is always stored as evidence. The server records an `IdentityCheck` row; the start
   API refuses a proctored attempt without one.

Trust boundary: the comparison happens on the client, so the server can't prove a match — it checks
the reported numbers are consistent and keeps both photos so a person can verify. That is why every
check keeps a snapshot.

**Random checks (during).** The fixed `setInterval` becomes a randomised schedule:
- presence check every `snapshotInterval × random(0.5–1.5)` seconds (MediaPipe);
- 4–6 identity checks at random moments spread across the exam (face-api vs the ID photo), each
  storing a snapshot + match score in a new `ProctoringCheck` row; a non-match also raises a
  `FACE_MISMATCH` flag.

**Activity on every exam.** A lightweight activity session (no camera) is created for every attempt.
The existing activity hook gains copy / cut / paste / right-click (prevented + logged) and the
PrintScreen key. Flags are debounced per type so one long absence doesn't flood the log.

**Staff panel.** The grade page's empty area becomes **Exam integrity**: risk level (Clear / Review /
High risk), identity (ID photo ↔ pre-exam photo, outcome, score), random-check gallery, counts per
activity type, and a timeline. Scoped like the grade page (College Admin, or HOD of the student's
department). The student result pages never include it.

## 5. Implementation Steps

1. **Schema (additive migration `exam_integrity`):**
   - `ProctoringFlagType` += `COPY`, `CUT`, `PASTE`, `CONTEXT_MENU`, `SCREENSHOT_ATTEMPT`,
     `SHORTCUT_BLOCKED`, `SECOND_SCREEN`, `IDENTITY_MISMATCH`.
   - `IdentityPhoto` — `userId`, `storagePath`, `source` (SELFIE / STUDENT_UPLOAD / COLLEGE_UPLOAD),
     `status` (APPROVED / PENDING / REJECTED), `orgId?`, `reviewedById?`, timestamps. Active photo =
     latest APPROVED.
   - `IdentityCheck` — one per assignment: `outcome` (ENROLLED / MATCHED / MISMATCH), `matchScore?`,
     `attempts`, `snapshotPath`, `photoId?`.
   - `ProctoringCheck` — random identity checks: `sessionId`, `matched`, `matchScore?`, `faceCount`,
     `snapshotPath?`, `occurredAt`.
   - Applied with `migrate diff` → reviewed SQL → `migrate deploy` (never `migrate dev`).
2. **Model files:** copy the three face-api models into `public/models/face-api/`.
3. **`lib/proctoring/face-identity.ts`** — lazy-load face-api + models; `describe(image)` →
   `{ faceCount, descriptor }`; `matchScore(a, b)`; `MATCH_MAX_DISTANCE = 0.55`.
4. **`services/identity.ts`** — active ID photo (signed URL), `submitIdentityCheck` (enrol or record,
   store snapshot, consistency checks), `getIdentityForReview`.
5. **APIs (exam browser + auth + token owner):** `GET/POST /api/exam/[token]/identity`;
   `POST /api/exam/[token]/proctoring/check` (random identity check);
   `POST /api/exam/[token]/proctoring/init` also accepts "activity only" (no photo).
6. **Start gate:** `startAttempt` refuses a proctored assessment without an `IdentityCheck`.
7. **Exam UI:**
   - `IdentityGate` on the entry page (proctored, in the exam browser, before Start).
   - `ProctoringMonitor`: random schedule, identity re-checks against the ID photo.
   - `ActivityMonitor` mounted on **every** attempt; the hook adds copy / cut / paste / right-click /
     PrintScreen.
8. **Staff UI:** `ExamIntegrityPanel` on the grade page (replaces the old proctoring section; also
   shown when only activity was tracked); integrity badge in mock-drive Live monitor cells and the
   results list.
9. **Mock drives:** `driveBlockers` requires proctoring on every round's test.
10. **Builder:** proctoring copy updated (identity check + random checks); the old cosine "face match
    threshold" input is removed (identity now uses the calibrated constant).

## 6. File Changes

| Action | File | Description |
|---|---|---|
| Modify | `prisma/schema.prisma` + migration | Enum values, IdentityPhoto, IdentityCheck, ProctoringCheck |
| Add | `public/models/face-api/*` | Self-hosted face-api models (~7 MB) |
| Create | `src/lib/proctoring/face-identity.ts` | On-device recognition helpers |
| Create | `src/services/identity.ts` | ID photo + identity check logic |
| Modify | `src/services/proctoring.ts` | Activity-only sessions, random checks, review data |
| Modify | `src/services/exam-session.ts` | Identity gate at start |
| Create | `src/app/api/exam/[token]/identity/route.ts` | Identity step |
| Create | `src/app/api/exam/[token]/proctoring/check/route.ts` | Random identity checks |
| Modify | `src/app/api/exam/[token]/proctoring/{init,flag}/route.ts` | Activity-only init, new flag types |
| Create | `src/components/exam/identity-gate.tsx` | Pre-exam identity step |
| Modify | `src/components/exam/proctoring-monitor.tsx`, `src/hooks/use-activity-monitor.ts` | Random schedule, more events |
| Create | `src/components/exam/activity-monitor.tsx` | Activity tracking for every exam |
| Modify | `src/app/exam/[token]/page.tsx`, `.../attempt/page.tsx` | Mount gate / monitors |
| Create | `src/components/proctoring/exam-integrity-panel.tsx` | Staff panel |
| Modify | grade page, mock-drive monitor, results list | Panel + badges |
| Modify | `src/services/mock-drives.ts`, assessment builder | Proctoring required for rounds; copy |

## 7. Testing / Verification

- [ ] Proctored test can't start without the identity step (API 403); non-proctored starts as before
- [ ] First identity check enrols the ID photo; the next exam compares against it
- [ ] MATCHED / MISMATCH recorded with snapshot; mismatch raises a HIGH alert, exam continues
- [ ] Inconsistent client report (e.g. MATCHED with a failing score) rejected
- [ ] Activity flags (copy, paste, screenshot attempt, tab switch…) recorded on a non-proctored exam
- [ ] Random identity checks stored with snapshots; non-match raises FACE_MISMATCH
- [ ] Grade page shows Exam integrity to College Admin and the student's HOD; another department's
      HOD and the student can't see it; student result pages never include it
- [ ] Drive with an unproctored round can't open registration
- [ ] face-api identity verified manually on a real camera in the exam browser (same person matches,
      a different person / photo of someone else doesn't)
- [ ] Regression suites pass; typecheck, lint, production build pass

## 8. Documentation Updates

- `docs/roles-and-permissions.md`: who sees exam integrity data.
- `docs/project-context.md` / `CLAUDE.md` text for SG to paste: identity check, random checks,
  activity log, face-api (on-device) alongside MediaPipe.

## 9. Estimated Effort

- Claude Code execution: ~2–3 hours (schema, services, 3 client components, staff panel, tests)
- Manual testing: ~30 minutes in the exam browser with a real camera (two people)
- Documentation: ~10 minutes

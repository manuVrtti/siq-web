# Plan 018c — Face Match Accuracy & Honest Scores

> Raised by SG on 2026-10-03: three near-identical photos showed "Match 76%" during the exam.
> "Make picture verification more efficient, healthy and accurate."

## 1. Objective

1. **Honest numbers.** Show a calibrated *confidence* that it's the same person, not "1 − distance".
   (76% was a face distance of 0.24 — a strong same-person match — displayed misleadingly.)
2. **More accurate matching.** Better face detector, several frames per check, quality gates, and
   a richer ID reference — fewer false alarms in poor light and fewer missed impersonations.
3. **Healthy for students.** Clear guidance when a photo is unusable (too dark, too far, turned
   away), instead of failing a try.

## 2. Scope

- **One photo at the start (SG):** the identity-check photo is the only start photo. The separate
  "At exam start" capture is removed; the camera monitor opens the session without a photo and then
  runs only random checks. On a first exam the start photo *is* the ID photo, shown once.

- Detector: SSD MobileNet v1 (more accurate) replaces Tiny Face Detector; Tiny kept as fallback.
- Every check uses **3 frames** (~150 ms apart); best usable frame wins (median of distances
  for the score).
- **Quality gate** per frame: exactly one face, detection score ≥ 0.8, face ≥ 18% of frame
  height, not too dark / too bright, roughly frontal (landmark yaw/pitch check). Unusable frames
  don't count as a try; the student is told what to fix.
- **Enrolment:** the ID photo is captured from 3 good frames; their **averaged descriptor** is kept
  for the exam (on device, in session storage), the best frame is stored as the photo.
- **Random checks** compare against the ID photo *and* the pre-exam photo and use the closer one
  (lighting drift during an exam).
- **Confidence** = logistic of distance, centred on the match threshold:
  `confidence = 1 / (1 + e^((d − 0.55) / 0.07))` → d 0.24 ≈ 99%, 0.40 ≈ 90%, 0.55 = 50%,
  0.70 ≈ 10%. Match = confidence ≥ 50% (same rule as before).
- Staff wording by band: **Strong match** (≥ 90%), **Likely match — review** (50–90%),
  **Different person** (< 50%); the raw distance is shown on hover.
- Server checks the new scale (same threshold); `matchScore` now stores confidence. Earlier rows
  (only SG's tests) were on the old scale and are converted by the migration.

### Out of scope
- Liveness / anti-spoofing (holding up a photo or screen) — next step.

## 3. Prerequisites
018b (identity check, random checks), 018 (MediaPipe presence checks). No new packages
(SSD model ships with @vladmandic/face-api; +5.6 MB, loaded once, cached).

## 4. Technical Approach
All maths stays on the student's computer. `lib/proctoring/identity-rules.ts` holds the
threshold, curve and bands so browser and server agree. Data migration converts old scores:
`d = 1 − old; confidence = 1/(1+exp((d−0.55)/0.07))`.

## 5. Implementation Steps
1. Add SSD model files to `public/models/face-api`.
2. `identity-rules.ts`: `distanceToConfidence`, `isMatch(confidence)`, bands, quality limits.
3. `face-identity.ts`: SSD + fallback, `captureBest(video, n=3)` with quality gate and reasons,
   `averageDescriptor`, `confidence(a, b)`.
4. `identity-gate.tsx`: 3-frame capture, guidance messages, averaged reference cached.
5. `proctoring-monitor.tsx`: random checks use 3 frames, compare with ID + pre-exam reference.
6. Server: same rules on the new scale; migration converts existing scores.
7. Staff panel: bands + confidence, distance on hover.
8. Tests (unit-style curve checks + existing suites), build, PR.

## 7. Testing / Verification
- [ ] Curve: d 0.24 → ~99%, 0.55 → 50%, 0.70 → ~10%
- [ ] Server accepts MATCHED ≥ 50%, rejects inconsistent reports; old rows converted
- [ ] Gate: dark / far / turned-away frame → guidance, try not consumed
- [ ] Integrity, retake, drives suites pass; build passes
- [ ] SG on a real camera: same person ≥ 90%; another person < 50%

## 9. Estimated Effort
~1.5 hours + SG's real-camera test.

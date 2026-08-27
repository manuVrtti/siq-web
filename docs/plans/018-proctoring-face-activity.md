# Plan 018 — Proctoring: Face Snapshot & Activity Monitoring

## 1. Objective

Implement exam proctoring: a reference photo capture, periodic face snapshot comparison via local MediaPipe, and activity monitoring (tab switches, focus loss) with flags surfaced in results.

## 2. Scope

- Reference photo capture at exam start
- Periodic webcam snapshots during exam
- Local face comparison using MediaPipe (client-side, privacy-preserving)
- Activity event logging (tab switch, focus loss, fullscreen exit)
- Proctoring model and flag storage
- Proctoring review UI for admins
- Integration of flags into results (Plan 16)

### Out of Scope

- Live human proctoring / video streaming
- Audio monitoring
- AI behavioral analysis beyond face presence/match
- Server-side face recognition (kept local for privacy + cost)

## 3. Prerequisites / Dependencies

- Plan 15 complete (exam runtime to instrument)
- Plan 17 complete (SEB context — webcam access managed by Electron)
- Plan 09 (Supabase storage for reference photo + snapshots)
- Plan 16 (results, to attach flags)

## 4. Technical Approach

Per the project design, face comparison happens locally via MediaPipe to preserve privacy and avoid server compute costs. The flow:

1. At exam start: capture a reference photo (stored in Supabase, private bucket)
2. During exam: periodically capture snapshots (configurable interval)
3. MediaPipe (client-side) computes face presence + similarity to reference
4. Anomalies (no face, multiple faces, low similarity) → logged as flags
5. Activity events (tab switch, focus loss) captured via browser events
6. All flags + snapshots persisted; admin reviews in results

Snapshots can be stored (for admin review) or discarded after comparison (config, for storage economy). Flags are always kept.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   enum ProctoringFlagType {
     NO_FACE
     MULTIPLE_FACES
     FACE_MISMATCH
     TAB_SWITCH
     FOCUS_LOSS
     FULLSCREEN_EXIT
     WINDOW_BLUR
   }

   enum FlagSeverity {
     LOW
     MEDIUM
     HIGH
   }

   model ProctoringSession {
     id            String    @id @default(cuid())
     attemptId     String    @unique
     userId        String
     referencePhotoUrl String?
     snapshotCount Int       @default(0)
     flagCount     Int       @default(0)
     createdAt     DateTime  @default(now())

     user          User      @relation(fields: [userId], references: [id])
     flags         ProctoringFlag[]

     @@index([userId])
   }

   model ProctoringFlag {
     id            String            @id @default(cuid())
     sessionId     String
     type          ProctoringFlagType
     severity      FlagSeverity      @default(LOW)
     snapshotUrl   String?
     similarity    Float?            // face match score if applicable
     metadata      Json?
     occurredAt    DateTime          @default(now())

     session       ProctoringSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

     @@index([sessionId])
     @@index([type])
   }
   ```
2. Run migration: `npx prisma migrate dev --name proctoring`
3. Add proctoring config to Assessment (Plan 12 extension):
   ```prisma
   // Add to Assessment model:
   proctoringEnabled     Boolean @default(false)
   snapshotIntervalSec   Int     @default(30)
   storeSnapshots        Boolean @default(true)
   faceMatchThreshold    Float   @default(0.6)
   ```
4. Install MediaPipe: `npm install @mediapipe/tasks-vision`
5. Create `lib/proctoring/face-detection.ts` (client-side):
   - Initialize MediaPipe FaceLandmarker / FaceDetector
   - `detectFaces(imageData)` — returns count + landmarks
   - `computeSimilarity(reference, current)` — face embedding comparison
   - All runs in-browser (WASM), no server calls
6. Create `components/exam/proctoring-monitor.tsx` (client component, mounted in attempt page):
   - Requests webcam access (granted in SEB context)
   - Captures reference photo on mount → uploads to Supabase → creates ProctoringSession
   - Sets interval for periodic snapshots
   - Runs MediaPipe comparison locally
   - On anomaly → POST flag to API (with optional snapshot upload)
   - Hidden/minimal UI (small webcam indicator)
7. Create `hooks/use-activity-monitor.ts`:
   - Listens for `visibilitychange`, `blur`, `fullscreenchange`
   - Debounced flag dispatch on suspicious events
8. Create API routes:
   - `/app/api/exam/[token]/proctoring/init/route.ts` — POST (create session, save reference)
   - `/app/api/exam/[token]/proctoring/flag/route.ts` — POST (log a flag)
   - `/app/api/proctoring/sessions/[id]/route.ts` — GET (admin review)
9. Integrate into exam attempt page (Plan 15):
   - Mount `ProctoringMonitor` when `assessment.proctoringEnabled`
   - Wire activity monitor hook
10. Integrate flags into results (Plan 16):
    - Result view shows proctoring summary (flag count, severity)
    - Admin can drill into flags with snapshots
11. Create `components/proctoring/proctoring-review.tsx`:
    - Timeline of flags with snapshots
    - Severity indicators
    - Shown in admin result detail page

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | ProctoringSession, Flag, Assessment config |
| Install | `@mediapipe/tasks-vision` | Local face detection |
| Create | `lib/proctoring/face-detection.ts` | MediaPipe wrapper |
| Create | `components/exam/proctoring-monitor.tsx` | In-exam monitor |
| Create | `hooks/use-activity-monitor.ts` | Activity event hook |
| Create | `app/api/exam/[token]/proctoring/init/route.ts` | Session init |
| Create | `app/api/exam/[token]/proctoring/flag/route.ts` | Flag logging |
| Create | `app/api/proctoring/sessions/[id]/route.ts` | Admin review |
| Modify | `app/exam/[token]/attempt/page.tsx` | Mount monitor |
| Modify | `components/results/result-breakdown.tsx` | Proctoring summary |
| Create | `components/proctoring/proctoring-review.tsx` | Flag review UI |

## 7. Testing / Verification

- [ ] Proctoring-enabled exam → webcam permission requested at start
- [ ] Reference photo captured and uploaded to Supabase (private bucket)
- [ ] ProctoringSession created
- [ ] Snapshots taken at configured interval
- [ ] MediaPipe runs locally (verify no face image sent to server for comparison)
- [ ] No face in frame → NO_FACE flag logged
- [ ] Second person appears → MULTIPLE_FACES flag
- [ ] Different person → FACE_MISMATCH flag (below threshold)
- [ ] Tab switch → TAB_SWITCH flag
- [ ] Focus loss / window blur → flag logged
- [ ] Fullscreen exit → FULLSCREEN_EXIT flag
- [ ] Proctoring-disabled exam → no webcam request, no monitoring
- [ ] Admin result view shows flag count + severity
- [ ] Admin can review flags with snapshots (if stored)
- [ ] `storeSnapshots: false` → snapshots discarded, only flags kept
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: proctoring architecture (local MediaPipe comparison, privacy rationale), flag types, config options
- Add to `CLAUDE.md`: "Face comparison is client-side only — reference/snapshots stored but embeddings compared locally"
- Add to `docs/project-context.md`: Plan 18 completed, proctoring live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~30 minutes (webcam scenarios, flag types, privacy verification)
- Documentation updates: ~5 minutes

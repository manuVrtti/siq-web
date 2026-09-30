'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { useActivityMonitor, type ActivityFlagType } from '@/hooks/use-activity-monitor'
import { analyze, similarity } from '@/lib/proctoring/face-detection'

/**
 * Plan 018 — client-side proctoring monitor.
 *
 * Lifecycle inside the exam attempt page:
 *
 *   1. Ask for webcam. If the candidate denies, flag WEBCAM_DENIED (HIGH)
 *      once and stop.
 *   2. Take a reference photo → POST it to /init to create the session
 *      → run MediaPipe on it locally → cache the descriptor for the run.
 *   3. Loop: every `intervalSec`, grab a frame, count faces, compute
 *      similarity vs the reference. Anomalies fire a flag POST.
 *   4. In parallel, `useActivityMonitor` posts activity flags.
 *
 * All ML runs in the browser (no video frames leave the device except the
 * reference photo + any snapshots the assessment opts to store). This is
 * the privacy promise for candidates.
 *
 * Rendered as a tiny PiP indicator so the candidate can see their webcam
 * is active — hiding it would feel worse than making it visible.
 */

type Props = {
  token: string
  intervalSec: number
  storeSnapshots: boolean
  faceMatchThreshold: number
}

type Status =
  | { kind: 'idle' }
  | { kind: 'requesting-camera' }
  | { kind: 'capturing-reference' }
  | { kind: 'monitoring' }
  | { kind: 'denied' }
  | { kind: 'error'; message: string }

const CAPTURE_WIDTH = 320
const CAPTURE_HEIGHT = 240
const JPEG_QUALITY = 0.7

/** LocalStorage key for the reference descriptor, keyed by token. */
function referenceStorageKey(token: string) {
  return `siq.proctoring.ref.${token}`
}

export default function ProctoringMonitor({
  token,
  intervalSec,
  storeSnapshots,
  faceMatchThreshold,
}: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const referenceDescriptorRef = useRef<Float32Array | null>(null)
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Rehydrate reference descriptor from localStorage in case of a page refresh
  // mid-exam. `useEffect` (not lazy state) because localStorage is a browser API.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(referenceStorageKey(token))
      if (!raw) return
      const parsed = JSON.parse(raw) as number[]
      if (Array.isArray(parsed) && parsed.length > 0) {
        referenceDescriptorRef.current = Float32Array.from(parsed)
      }
    } catch {
      // Corrupt cache — no harm, we'll re-capture the reference.
    }
  }, [token])

  const postFlag = useCallback(
    async (
      type:
        | 'NO_FACE'
        | 'MULTIPLE_FACES'
        | 'FACE_MISMATCH'
        | 'WEBCAM_DENIED'
        | ActivityFlagType,
      opts: {
        severity?: 'LOW' | 'MEDIUM' | 'HIGH'
        similarity?: number
        metadata?: Record<string, unknown>
        snapshotBlob?: Blob | null
      } = {},
    ) => {
      const severity = opts.severity ?? 'LOW'
      const includeSnapshot = storeSnapshots && opts.snapshotBlob
      try {
        if (includeSnapshot && opts.snapshotBlob) {
          const form = new FormData()
          form.append(
            'flag',
            JSON.stringify({
              type,
              severity,
              similarity: opts.similarity ?? null,
              metadata: opts.metadata ?? null,
            }),
          )
          form.append('snapshot', opts.snapshotBlob, 'snapshot.jpg')
          await fetch(`/api/exam/${token}/proctoring/flag`, {
            method: 'POST',
            body: form,
          })
        } else {
          await fetch(`/api/exam/${token}/proctoring/flag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type,
              severity,
              similarity: opts.similarity ?? null,
              metadata: opts.metadata ?? null,
            }),
          })
        }
      } catch {
        // Network hiccups are non-fatal; the next tick will try again.
      }
    },
    [storeSnapshots, token],
  )

  useActivityMonitor({
    enabled: status.kind === 'monitoring',
    onFlag: (type, metadata) => {
      void postFlag(type, { severity: 'MEDIUM', metadata })
    },
  })

  /** Draw the current video frame into the offscreen canvas and return a JPEG blob. */
  const grabSnapshot = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return null
    if (video.readyState < 2) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    canvas.width = CAPTURE_WIDTH
    canvas.height = CAPTURE_HEIGHT
    ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT)
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY))
  }, [])

  /** One iteration of the monitor loop. */
  const tick = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      const observation = await analyze(canvas)
      if (observation.faceCount === 0) {
        const snap = storeSnapshots ? await grabSnapshot() : null
        await postFlag('NO_FACE', { severity: 'MEDIUM', snapshotBlob: snap })
        return
      }
      if (observation.faceCount > 1) {
        const snap = storeSnapshots ? await grabSnapshot() : null
        await postFlag('MULTIPLE_FACES', {
          severity: 'HIGH',
          metadata: { faceCount: observation.faceCount },
          snapshotBlob: snap,
        })
        return
      }
      // Exactly one face — check similarity if we have a reference.
      const ref = referenceDescriptorRef.current
      if (ref && observation.descriptor) {
        const sim = similarity(ref, observation.descriptor)
        if (sim < faceMatchThreshold) {
          const snap = storeSnapshots ? await grabSnapshot() : null
          await postFlag('FACE_MISMATCH', {
            severity: 'HIGH',
            similarity: sim,
            snapshotBlob: snap,
          })
        }
      }
    } catch {
      // Frame-level failure is not fatal. Next tick tries again.
    }
  }, [faceMatchThreshold, grabSnapshot, postFlag, storeSnapshots])

  /** Full bring-up: camera → reference photo → init API → start loop. */
  const start = useCallback(async () => {
    setStatus({ kind: 'requesting-camera' })
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      })
    } catch {
      setStatus({ kind: 'denied' })
      await postFlag('WEBCAM_DENIED', { severity: 'HIGH' })
      return
    }
    streamRef.current = stream

    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    await video.play().catch(() => {})

    // Wait for the first frame so getUserMedia isn't racing analysis.
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) return resolve()
      const onLoaded = () => {
        video.removeEventListener('loadeddata', onLoaded)
        resolve()
      }
      video.addEventListener('loadeddata', onLoaded)
    })

    setStatus({ kind: 'capturing-reference' })
    const referenceBlob = await grabSnapshot()
    if (!referenceBlob) {
      setStatus({ kind: 'error', message: 'Could not capture reference photo' })
      return
    }

    // Compute descriptor client-side — never leaves the device.
    try {
      const canvas = canvasRef.current
      if (canvas) {
        const obs = await analyze(canvas)
        if (obs.descriptor) {
          referenceDescriptorRef.current = obs.descriptor
          try {
            localStorage.setItem(
              referenceStorageKey(token),
              JSON.stringify(Array.from(obs.descriptor)),
            )
          } catch {
            /* quota — non-fatal */
          }
        }
      }
    } catch {
      // We can still run without a descriptor; presence checks still work.
    }

    // Upload the reference photo. The server's `initSession` is idempotent
    // per attempt, so a retry after refresh is safe.
    try {
      const form = new FormData()
      form.append('photo', referenceBlob, 'reference.jpg')
      const res = await fetch(`/api/exam/${token}/proctoring/init`, {
        method: 'POST',
        body: form,
      })
      if (!res.ok) {
        setStatus({ kind: 'error', message: 'Could not initialise proctoring' })
        return
      }
    } catch {
      setStatus({ kind: 'error', message: 'Could not initialise proctoring' })
      return
    }

    setStatus({ kind: 'monitoring' })
    loopTimerRef.current = setInterval(() => {
      void tick()
    }, intervalSec * 1000)
  }, [grabSnapshot, intervalSec, postFlag, tick, token])

  useEffect(() => {
    // `start` calls setStatus BEFORE its first await, which the React 19
    // linter flags as "setState in effect". Defer with queueMicrotask so
    // the first state change happens outside the effect body.
    queueMicrotask(() => {
      void start()
    })
    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current)
      loopTimerRef.current = null
      if (streamRef.current) {
        for (const t of streamRef.current.getTracks()) t.stop()
        streamRef.current = null
      }
    }
    // start is stable enough — depends only on constant props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-1"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        className="border-border pointer-events-none h-24 w-32 rounded-md border object-cover shadow"
      />
      <canvas ref={canvasRef} className="hidden" />
      <span
        className={
          'rounded-full px-2 py-0.5 text-[10px] font-medium ' +
          (status.kind === 'monitoring'
            ? 'bg-success/10 text-success'
            : status.kind === 'denied' || status.kind === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-muted text-muted-foreground')
        }
      >
        {statusLabel(status)}
      </span>
    </div>
  )
}

function statusLabel(s: Status): string {
  switch (s.kind) {
    case 'idle':
      return 'starting…'
    case 'requesting-camera':
      return 'requesting camera…'
    case 'capturing-reference':
      return 'capturing reference…'
    case 'monitoring':
      return 'proctoring active'
    case 'denied':
      return 'camera denied'
    case 'error':
      return s.message
  }
}

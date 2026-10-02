'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { identityRefKey } from '@/components/exam/identity-gate'
import { useActivityMonitor } from '@/hooks/use-activity-monitor'
import { initActivitySession, postActivityFlag } from '@/lib/proctoring/activity'
import { analyze } from '@/lib/proctoring/face-detection'
import { describe, isMatch, matchScore } from '@/lib/proctoring/face-identity'
import { RANDOM_CHECKS_MAX, RANDOM_CHECKS_MIN } from '@/lib/proctoring/identity-rules'

/**
 * Plans 018 / 018b — in-exam proctoring for a camera-proctored test.
 *
 *   activity   — from the first second (tab switch, copy/paste, screenshot…)
 *   presence   — MediaPipe at RANDOM intervals (intervalSec × 0.5–1.5):
 *                no face → NO_FACE, more than one → MULTIPLE_FACES
 *   identity   — 4–6 checks at random moments before the deadline: face-api
 *                compares the live face with the ID photo (cached by the
 *                identity gate); each check stores a snapshot for staff, and a
 *                different face raises FACE_MISMATCH (server side)
 *
 * Face maths runs on this device. Uploaded: flags, scores, and snapshots.
 */

type Props = {
  token: string
  intervalSec: number
  storeSnapshots: boolean
  deadlineAtIso: string
}

type Status = 'starting' | 'camera' | 'monitoring' | 'denied' | 'error'

const W = 320
const H = 240

export default function ProctoringMonitor({ token, intervalSec, storeSnapshots, deadlineAtIso }: Props) {
  const [status, setStatus] = useState<Status>('starting')
  const [activityOn, setActivityOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const refDescriptor = useRef<Float32Array | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useActivityMonitor({
    enabled: activityOn,
    onFlag: (type, metadata) => void postActivityFlag(token, type, metadata),
  })

  const grab = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return null
    canvas.width = W
    canvas.height = H
    canvas.getContext('2d')?.drawImage(video, 0, 0, W, H)
    return new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.7))
  }, [])

  const postFlag = useCallback(
    async (type: 'NO_FACE' | 'MULTIPLE_FACES' | 'WEBCAM_DENIED', severity: 'MEDIUM' | 'HIGH', snapshot: Blob | null, metadata?: Record<string, unknown>) => {
      try {
        if (snapshot && storeSnapshots) {
          const form = new FormData()
          form.append('flag', JSON.stringify({ type, severity, metadata: metadata ?? null }))
          form.append('snapshot', snapshot, 'snapshot.jpg')
          await fetch(`/api/exam/${token}/proctoring/flag`, { method: 'POST', body: form })
        } else {
          await fetch(`/api/exam/${token}/proctoring/flag`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, severity, metadata: metadata ?? null }),
          })
        }
      } catch {
        /* next check will try again */
      }
    },
    [storeSnapshots, token],
  )

  /** One presence check (MediaPipe). Scheduled at random intervals by start(). */
  const presence = useCallback(async () => {
    const snap = await grab()
    if (snap && canvasRef.current) {
      try {
        const o = await analyze(canvasRef.current)
        if (o.faceCount === 0) await postFlag('NO_FACE', 'MEDIUM', snap)
        else if (o.faceCount > 1) await postFlag('MULTIPLE_FACES', 'HIGH', snap, { faceCount: o.faceCount })
      } catch {
        /* frame-level failure: ignore */
      }
    }
  }, [grab, postFlag])

  /** One random identity check (face-api) — always keeps its snapshot for staff. */
  const identity = useCallback(async () => {
    const snap = await grab()
    if (!snap || !canvasRef.current) return
    try {
      const live = await describe(canvasRef.current)
      const ref = refDescriptor.current
      const score = live.descriptor && ref ? matchScore(live.descriptor, ref) : null
      const form = new FormData()
      form.append('matched', String(live.faceCount === 1 && (score === null || isMatch(score))))
      form.append('matchScore', score === null ? '' : String(Math.round(score * 1000) / 1000))
      form.append('faceCount', String(live.faceCount))
      form.append('snapshot', snap, 'check.jpg')
      await fetch(`/api/exam/${token}/proctoring/check`, { method: 'POST', body: form })
    } catch {
      /* model or network hiccup: skip this one */
    }
  }, [grab, token])

  const start = useCallback(async () => {
    // 1. Activity from the very first second.
    if (await initActivitySession(token)) setActivityOn(true)

    // 2. Camera.
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
    } catch {
      setStatus('denied')
      await postFlag('WEBCAM_DENIED', 'HIGH', null)
      return
    }
    streamRef.current = stream
    setStatus('camera')
    const video = videoRef.current
    if (!video) return
    video.srcObject = stream
    await video.play().catch(() => {})
    await new Promise<void>((resolve) => {
      if (video.readyState >= 2) return resolve()
      video.addEventListener('loadeddata', () => resolve(), { once: true })
    })

    // 3. Exam-start reference photo (kept on the session for staff).
    const reference = await grab()
    if (reference) {
      const form = new FormData()
      form.append('photo', reference, 'reference.jpg')
      await fetch(`/api/exam/${token}/proctoring/init`, { method: 'POST', body: form }).catch(() => null)
    }

    // 4. Who to compare with: the ID photo from the identity gate, else this start photo.
    try {
      const raw = sessionStorage.getItem(identityRefKey(token))
      if (raw) refDescriptor.current = Float32Array.from(JSON.parse(raw) as number[])
    } catch {
      /* no cached ID descriptor */
    }
    if (!refDescriptor.current && canvasRef.current) {
      try {
        refDescriptor.current = (await describe(canvasRef.current)).descriptor
      } catch {
        /* identity checks will still record faces and snapshots */
      }
    }

    setStatus('monitoring')

    // 5. Random presence loop + 4–6 identity checks at random moments.
    const loop = () => {
      const delay = intervalSec * 1000 * (0.5 + Math.random())
      timers.current.push(
        setTimeout(() => {
          void presence().finally(loop)
        }, delay),
      )
    }
    loop()
    const remaining = new Date(deadlineAtIso).getTime() - Date.now()
    if (remaining > 60_000) {
      const k = RANDOM_CHECKS_MIN + Math.floor(Math.random() * (RANDOM_CHECKS_MAX - RANDOM_CHECKS_MIN + 1))
      for (let i = 0; i < k; i++) {
        // Spread across the exam: one random moment inside each of k slices.
        const at = remaining * ((i + 0.1 + Math.random() * 0.8) / k)
        timers.current.push(setTimeout(() => void identity(), at))
      }
    }
  }, [deadlineAtIso, grab, identity, intervalSec, postFlag, presence, token])

  useEffect(() => {
    queueMicrotask(() => void start())
    const pending = timers.current
    return () => {
      for (const t of pending) clearTimeout(t)
      for (const t of streamRef.current?.getTracks() ?? []) t.stop()
      streamRef.current = null
    }
    // start once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div aria-live="polite" className="fixed right-4 bottom-4 z-50 flex flex-col items-end gap-1">
      <video ref={videoRef} muted playsInline className="border-border pointer-events-none h-24 w-32 rounded-md border object-cover shadow" />
      <canvas ref={canvasRef} className="hidden" />
      <span
        className={
          'rounded-full px-2 py-0.5 text-[10px] font-medium ' +
          (status === 'monitoring' ? 'bg-success/10 text-success' : status === 'denied' || status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')
        }
      >
        {status === 'monitoring' ? 'proctoring active' : status === 'denied' ? 'camera denied' : status === 'error' ? 'proctoring error' : 'starting…'}
      </span>
    </div>
  )
}

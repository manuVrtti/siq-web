'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, Loader2, ShieldAlert, UserCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ISSUE_TEXT, averageDescriptor, captureFrames, confidence, describe, isMatch, loadFaceApi, loadImage } from '@/lib/proctoring/face-identity'
import { IDENTITY_MAX_ATTEMPTS } from '@/lib/proctoring/identity-rules'

/**
 * Plan 018b — the identity step before a proctored exam (inside the exam
 * browser). Live photo → compared ON THIS DEVICE with the student's ID photo
 * (face-api). First proctored exam: the live photo becomes the ID photo.
 * Three tries; after that the exam continues and the college is alerted.
 *
 * The descriptor used for random in-exam checks is cached in
 * sessionStorage (same tab, survives the hop to the attempt page and a
 * refresh); it never leaves the device.
 */

export const identityRefKey = (token: string) => `siq.identity.ref.${token}`

type Phase =
  | { kind: 'intro' }
  | { kind: 'camera' }
  | { kind: 'checking'; note: string }
  | { kind: 'retry'; message: string }
  | { kind: 'done'; outcome: 'ENROLLED' | 'MATCHED' | 'MISMATCH' }
  | { kind: 'error'; message: string }

export default function IdentityGate({ token, onDone }: { token: string; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' })
  const [attempt, setAttempt] = useState(0)
  const [cameraOn, setCameraOn] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  // undefined = not looked up yet; { exists:false } = no ID photo; descriptor null = photo unreadable.
  const idRef = useRef<{ exists: boolean; descriptor: Float32Array | null } | undefined>(undefined)

  const stopCamera = useCallback(() => {
    for (const t of streamRef.current?.getTracks() ?? []) t.stop()
    streamRef.current = null
    setCameraOn(false)
  }, [])
  useEffect(
    () => () => {
      for (const t of streamRef.current?.getTracks() ?? []) t.stop()
    },
    [],
  )

  async function openCamera() {
    setPhase({ kind: 'checking', note: 'Turning on your camera…' })
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      streamRef.current = stream
      setCameraOn(true)
      setPhase({ kind: 'camera' })
      // Pre-load the face models while the student gets ready.
      void loadFaceApi().catch(() => {})
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play().catch(() => {})
        }
      })
    } catch {
      setPhase({ kind: 'error', message: 'We need your camera for this exam. Allow camera access and try again.' })
    }
  }

  async function submit(blob: Blob, outcome: string, score: number | null, attempts: number) {
    const form = new FormData()
    form.append('snapshot', blob, 'identity.jpg')
    form.append('outcome', outcome)
    form.append('matchScore', score === null ? '' : String(score))
    form.append('attempts', String(attempts))
    const res = await fetch(`/api/exam/${token}/identity`, { method: 'POST', body: form })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? 'Could not save the identity check')
    return json.data.outcome as 'ENROLLED' | 'MATCHED' | 'MISMATCH'
  }

  async function verify() {
    setPhase({ kind: 'checking', note: 'Loading face check…' })
    try {
      await loadFaceApi()
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) throw new Error('Could not read the camera')
      setPhase({ kind: 'checking', note: 'Hold still — taking your photo…' })
      // 018c — 3 frames, quality-checked; a bad picture never costs a try.
      const shot = await captureFrames(video, canvas)
      if (shot.usable.length === 0) {
        setPhase({ kind: 'retry', message: ISSUE_TEXT[shot.issue ?? 'UNCLEAR'] })
        return
      }
      const best = shot.usable[0]!
      const blob = best.blob
      if (!blob) throw new Error('Could not read the camera')
      const liveDs = shot.usable.map((u) => u.frame.descriptor!)
      setPhase({ kind: 'checking', note: 'Checking it’s you…' })

      // Look up the ID photo once.
      if (idRef.current === undefined) {
        const st = await fetch(`/api/exam/${token}/identity`).then((r) => r.json())
        if (!st?.success) throw new Error(st?.error?.message ?? 'Could not load your ID photo')
        if (!st.data.idPhotoUrl) idRef.current = { exists: false, descriptor: null }
        else {
          const img = await loadImage(st.data.idPhotoUrl)
          idRef.current = { exists: true, descriptor: (await describe(img, false)).descriptor }
        }
      }
      const id = idRef.current
      const liveAvg = averageDescriptor(liveDs)!

      const n = attempt + 1
      setAttempt(n)
      let outcome: 'ENROLLED' | 'MATCHED' | 'MISMATCH'
      if (!id.exists) {
        // First proctored exam: this (best) photo becomes the ID photo.
        outcome = await submit(blob, 'ENROLLED', null, n)
        cacheRefs([liveAvg])
      } else if (!id.descriptor) {
        // The ID photo itself can't be read: no point retrying — staff review it.
        outcome = await submit(blob, 'MISMATCH', null, IDENTITY_MAX_ATTEMPTS)
        cacheRefs([liveAvg])
      } else {
        const res = confidence(liveDs, [id.descriptor])!
        if (isMatch(res.confidence)) {
          outcome = await submit(blob, 'MATCHED', res.confidence, n)
          // Random checks compare with the ID photo AND today's start photo.
          cacheRefs([id.descriptor, liveAvg])
        } else if (n < IDENTITY_MAX_ATTEMPTS) {
          setPhase({ kind: 'retry', message: `That didn’t match your ID photo (try ${n} of ${IDENTITY_MAX_ATTEMPTS}). Face the camera directly, take off anything covering your face, and keep the light in front of you.` })
          return
        } else {
          outcome = await submit(blob, 'MISMATCH', res.confidence, n)
          // Random checks keep comparing with the ID photo only, so a stand-in stays visible.
          cacheRefs([id.descriptor])
        }
      }
      stopCamera()
      setPhase({ kind: 'done', outcome })
    } catch (e) {
      setPhase({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong' })
    }
  }

  function cacheRefs(ds: Float32Array[]) {
    try {
      sessionStorage.setItem(identityRefKey(token), JSON.stringify(ds.map((d) => Array.from(d))))
    } catch {
      /* storage blocked — random checks still record faces and snapshots */
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <UserCheck className="text-primary size-5" aria-hidden />
        <h3 className="text-sm font-semibold">Identity check</h3>
      </div>

      {phase.kind === 'intro' ? (
        <>
          <p className="text-muted-foreground text-sm">
            This exam is proctored. We’ll take a quick photo to confirm it’s you, then check again a few times during
            the exam. Face matching runs on this computer; your college sees the photos.
          </p>
          <Button className="self-start" onClick={openCamera}>
            <Camera className="size-4" aria-hidden /> Turn on camera
          </Button>
        </>
      ) : null}

      {phase.kind === 'camera' || phase.kind === 'retry' || (phase.kind === 'checking' && cameraOn) ? (
        <div className="flex flex-col gap-3">
          <video ref={videoRef} muted playsInline className="aspect-[4/3] w-full max-w-sm rounded-lg border bg-black object-cover" />
          {phase.kind === 'retry' ? <p className="text-warning text-sm">{phase.message}</p> : null}
          {phase.kind === 'checking' ? (
            <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden /> {phase.note}
            </p>
          ) : (
            <Button className="self-start" onClick={verify}>
              Verify it’s me
            </Button>
          )}
        </div>
      ) : null}

      {phase.kind === 'checking' && !cameraOn ? (
        <p className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {phase.note}
        </p>
      ) : null}

      {phase.kind === 'done' ? (
        <div className="flex flex-col gap-3">
          {phase.outcome === 'MISMATCH' ? (
            <p className="text-warning inline-flex items-start gap-2 text-sm">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              We couldn’t confirm it’s you. You can still take the exam — your college will review the photos.
            </p>
          ) : (
            <p className="text-success inline-flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4" aria-hidden />
              {phase.outcome === 'ENROLLED' ? 'Photo saved as your ID photo for future exams.' : 'Verified — it’s you.'}
            </p>
          )}
          <Button className="self-start" onClick={onDone}>
            Continue
          </Button>
        </div>
      ) : null}

      {phase.kind === 'error' ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-destructive text-sm">
            {phase.message}
          </p>
          <Button variant="outline" className="self-start" onClick={() => setPhase({ kind: 'intro' })}>
            Try again
          </Button>
        </div>
      ) : null}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}


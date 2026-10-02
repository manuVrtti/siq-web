/**
 * Plans 018b / 018c — on-device face RECOGNITION (is this the same person?).
 *
 * @vladmandic/face-api: SSD MobileNet v1 detector (accurate; Tiny Face
 * Detector as fallback) → 68-point landmarks (alignment) → 128-number
 * descriptor. Every check reads several frames, drops unusable ones (dark,
 * far, turned away, not exactly one face) and scores the best.
 *
 * Runs entirely in the browser; models are self-hosted under
 * /public/models/face-api. Descriptors never leave the device.
 */

import type * as FaceApi from '@vladmandic/face-api'

import { QUALITY, distanceToConfidence, isMatchConfidence } from '@/lib/proctoring/identity-rules'

const MODEL_URL = '/models/face-api'

let ready: Promise<{ faceapi: typeof FaceApi; ssd: boolean }> | null = null

/** Lazy-load the library + models once per tab. */
export function loadFaceApi() {
  if (!ready) {
    ready = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await Promise.all([faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)])
      let ssd = true
      try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL)
      } catch {
        ssd = false
      }
      if (!ssd) await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
      return { faceapi, ssd }
    })().catch((e) => {
      ready = null // let a later call retry
      throw e
    })
  }
  return ready
}

type Input = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement

/** Why a frame can't be used — shown to the student as guidance. */
export type FrameIssue = 'NO_FACE' | 'MANY_FACES' | 'TOO_FAR' | 'TOO_DARK' | 'TOO_BRIGHT' | 'TURNED' | 'UNCLEAR'

export const ISSUE_TEXT: Record<FrameIssue, string> = {
  NO_FACE: 'We can’t see your face. Sit facing the camera.',
  MANY_FACES: 'More than one face is visible. Only you should be in the frame.',
  TOO_FAR: 'Move a little closer to the camera.',
  TOO_DARK: 'It’s too dark. Turn on a light in front of you.',
  TOO_BRIGHT: 'Too much light behind or on you. Move away from the window or lamp.',
  TURNED: 'Look straight at the screen.',
  UNCLEAR: 'The picture isn’t clear. Hold still and look at the camera.',
}

export type Frame = {
  faceCount: number
  descriptor: Float32Array | null
  issue: FrameIssue | null
  /** Higher = better quality (used to pick the best frame). */
  quality: number
}

function brightness(input: Input, box: { x: number; y: number; width: number; height: number }) {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return 128
  ctx.drawImage(input as CanvasImageSource, box.x, box.y, box.width, box.height, 0, 0, 32, 32)
  const d = ctx.getImageData(0, 0, 32, 32).data
  let sum = 0
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!
  return sum / (d.length / 4)
}

function sizeOf(input: Input) {
  if (input instanceof HTMLVideoElement) return { w: input.videoWidth, h: input.videoHeight }
  if (input instanceof HTMLImageElement) return { w: input.naturalWidth, h: input.naturalHeight }
  return { w: input.width, h: input.height }
}

/** One frame: detect, quality-gate, describe. */
export async function describe(input: Input, gate = true): Promise<Frame> {
  const { faceapi, ssd } = await loadFaceApi()
  const options = ssd
    ? new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 3 })
    : new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 })
  const all = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
  if (all.length === 0) return { faceCount: 0, descriptor: null, issue: 'NO_FACE', quality: 0 }
  if (all.length > 1) return { faceCount: all.length, descriptor: null, issue: 'MANY_FACES', quality: 0 }
  const f = all[0]!
  const box = f.detection.box
  const score = f.detection.score
  if (!gate) return { faceCount: 1, descriptor: f.descriptor, issue: null, quality: score }

  const { h } = sizeOf(input)
  const heightShare = h ? box.height / h : 1
  const light = brightness(input, box)
  const pts = f.landmarks.positions
  // Eyes: 36–41 / 42–47, nose tip: 30.
  const avg = (from: number, to: number) => {
    let x = 0
    for (let i = from; i <= to; i++) x += pts[i]!.x
    return x / (to - from + 1)
  }
  const leftEye = avg(36, 41)
  const rightEye = avg(42, 47)
  const eyeDist = Math.abs(rightEye - leftEye) || 1
  const yaw = Math.abs(pts[30]!.x - (leftEye + rightEye) / 2) / eyeDist

  let issue: FrameIssue | null = null
  if (score < QUALITY.minDetectionScore) issue = 'UNCLEAR'
  else if (heightShare < QUALITY.minFaceHeight) issue = 'TOO_FAR'
  else if (light < QUALITY.minBrightness) issue = 'TOO_DARK'
  else if (light > QUALITY.maxBrightness) issue = 'TOO_BRIGHT'
  else if (yaw > QUALITY.maxYaw) issue = 'TURNED'
  const quality = score * Math.min(1, heightShare / 0.35) * (1 - Math.min(1, yaw))
  return { faceCount: 1, descriptor: f.descriptor, issue, quality }
}

/**
 * Several frames from a live video, ~160 ms apart. Returns the usable ones
 * (best first) and, if none were usable, the most common problem.
 */
export async function captureFrames(video: HTMLVideoElement, canvas: HTMLCanvasElement, n: number = QUALITY.frames) {
  const usable: { frame: Frame; blob: Blob | null }[] = []
  const issues: FrameIssue[] = []
  let faces = 0
  for (let i = 0; i < n; i++) {
    if (i) await new Promise((r) => setTimeout(r, QUALITY.frameGapMs))
    if (video.readyState < 2) continue
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const frame = await describe(canvas)
    faces = Math.max(faces, frame.faceCount)
    if (frame.issue || !frame.descriptor) {
      if (frame.issue) issues.push(frame.issue)
      continue
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.85))
    usable.push({ frame, blob })
  }
  usable.sort((a, b) => b.frame.quality - a.frame.quality)
  const counts = new Map<FrameIssue, number>()
  for (const x of issues) counts.set(x, (counts.get(x) ?? 0) + 1)
  const issue = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  return { usable, issue, maxFaces: faces }
}

/** Mean of several descriptors (a steadier reference than one frame). */
export function averageDescriptor(ds: Float32Array[]): Float32Array | null {
  if (ds.length === 0) return null
  const out = new Float32Array(ds[0]!.length)
  for (const d of ds) for (let i = 0; i < out.length; i++) out[i]! += d[i]! / ds.length
  return out
}

export function distance(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return Infinity
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!
    sum += d * d
  }
  return Math.sqrt(sum)
}

/**
 * Confidence that the live frames show the reference person: the MEDIAN
 * distance of the usable frames to the closest reference.
 */
export function confidence(live: Float32Array[], refs: Float32Array[]): { confidence: number; distance: number } | null {
  if (!live.length || !refs.length) return null
  const ds = live.map((l) => Math.min(...refs.map((r) => distance(l, r)))).sort((a, b) => a - b)
  const median = ds[Math.floor(ds.length / 2)]!
  return { confidence: Math.round(distanceToConfidence(median) * 1000) / 1000, distance: Math.round(median * 1000) / 1000 }
}

export const isMatch = isMatchConfidence

/** Load an image URL (e.g. the signed ID-photo URL) into an <img>. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the ID photo'))
    img.src = url
  })
}

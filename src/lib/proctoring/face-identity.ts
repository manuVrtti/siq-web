/**
 * Plan 018b — on-device face RECOGNITION (is this the same person?).
 *
 * MediaPipe (face-detection.ts) answers "how many faces?". This answers
 * "whose face?": @vladmandic/face-api computes a 128-number descriptor per
 * face; two photos of the same person are close (Euclidean distance ≲ 0.5),
 * different people are far (≳ 0.6).
 *
 * Runs entirely in the browser. Models are self-hosted under
 * /public/models/face-api so the exam browser needs no extra domain. No
 * descriptor ever leaves the device — only a match score and, for human
 * review, the snapshot.
 */

import type * as FaceApi from '@vladmandic/face-api'

import { MIN_MATCH_SCORE } from '@/lib/proctoring/identity-rules'

const MODEL_URL = '/models/face-api'

let ready: Promise<typeof FaceApi> | null = null

/** Lazy-load the library + the three models once per tab. */
export function loadFaceApi(): Promise<typeof FaceApi> {
  if (!ready) {
    ready = (async () => {
      const faceapi = await import('@vladmandic/face-api')
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ])
      return faceapi
    })().catch((e) => {
      ready = null // let a later call retry
      throw e
    })
  }
  return ready
}

export type Identity = {
  /** Faces found in the frame. */
  faceCount: number
  /** Descriptor of the single face; null when faceCount !== 1. */
  descriptor: Float32Array | null
}

type Input = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement

export async function describe(input: Input): Promise<Identity> {
  const faceapi = await loadFaceApi()
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
  const all = await faceapi.detectAllFaces(input, options).withFaceLandmarks().withFaceDescriptors()
  if (all.length !== 1) return { faceCount: all.length, descriptor: null }
  return { faceCount: 1, descriptor: all[0]!.descriptor }
}

/** 1 − Euclidean distance, clamped to 0…1. Higher = more alike. */
export function matchScore(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!
    sum += d * d
  }
  return Math.max(0, Math.min(1, 1 - Math.sqrt(sum)))
}

/** Same rule the server uses to sanity-check reported outcomes (identity-rules.ts). */
export function isMatch(score: number): boolean {
  return score >= MIN_MATCH_SCORE
}

/** Load an image URL (e.g. the signed ID-photo URL) into an <img> for describe(). */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load the ID photo'))
    img.src = url
  })
}

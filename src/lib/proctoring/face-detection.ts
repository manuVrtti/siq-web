/**
 * Plan 018 — client-side face detection & similarity via MediaPipe.
 *
 * Runs entirely in the browser (WASM). No image bytes leave the device for
 * comparison — only the derived flag ("NO_FACE at t=…", "similarity=0.42")
 * plus an optional snapshot (when the assessment has `storeSnapshots=true`)
 * are ever uploaded. That is the privacy contract we ship to candidates.
 *
 * We use FaceLandmarker rather than FaceDetector because it does two jobs at
 * once: the number of faces detected gives us NO_FACE / MULTIPLE_FACES, and
 * the 478-point landmark grid gives us a shape descriptor we can compare
 * against the reference photo for FACE_MISMATCH.
 *
 * The similarity number is a *shape signature*, not a proper biometric
 * embedding. It's cheap, deterministic and privacy-friendly, but only
 * reliably distinguishes "same face, same pose" from "clearly different
 * person". Threshold `faceMatchThreshold` on the assessment (default 0.6)
 * needs tuning per college — see PR notes.
 */

import type { FaceLandmarker, FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'

let landmarkerPromise: Promise<FaceLandmarker> | null = null

async function createLandmarker(): Promise<FaceLandmarker> {
  // Dynamic import so the ~1MB WASM bundle only loads when proctoring runs.
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')

  // storage.googleapis.com is already in SEB's domain allow-list, so these
  // fetches succeed inside the shell.
  const filesetResolver = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm',
  )
  return FaceLandmarker.createFromOptions(filesetResolver, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'IMAGE',
    numFaces: 3, // enough to distinguish 0 / 1 / >=2
    outputFaceBlendshapes: false,
    outputFacialTransformationMatrixes: false,
  })
}

/** Lazy singleton — one landmarker per tab. */
export function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) landmarkerPromise = createLandmarker()
  return landmarkerPromise
}

export type FaceObservation = {
  faceCount: number
  /** Non-null only when exactly one face was detected. */
  descriptor: Float32Array | null
}

export async function analyze(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap,
): Promise<FaceObservation> {
  const landmarker = await getLandmarker()
  const result: FaceLandmarkerResult = landmarker.detect(input)
  const faces = result.faceLandmarks ?? []
  const faceCount = faces.length
  const descriptor =
    faceCount === 1 && faces[0] && faces[0].length > 0 ? buildDescriptor(faces[0]) : null
  return { faceCount, descriptor }
}

/**
 * Compact shape signature from 478 landmarks.
 *
 * MediaPipe returns each landmark as a normalized {x, y, z} in [0, 1] (image
 * space). We recentre on the centroid and rescale by the mean radial
 * distance so head position/scale wash out — what's left is roughly the
 * facial *shape*. Cosine similarity between two descriptors is high for the
 * same face and low for different ones. Not a biometric — see file header.
 */
function buildDescriptor(landmarks: NormalizedLandmark[]): Float32Array {
  const n = landmarks.length
  let cx = 0
  let cy = 0
  let cz = 0
  for (const p of landmarks) {
    cx += p.x
    cy += p.y
    cz += p.z
  }
  cx /= n
  cy /= n
  cz /= n

  let scale = 0
  for (const p of landmarks) {
    const dx = p.x - cx
    const dy = p.y - cy
    const dz = p.z - cz
    scale += Math.sqrt(dx * dx + dy * dy + dz * dz)
  }
  scale = scale / n || 1

  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const p = landmarks[i]!
    out[i * 3] = (p.x - cx) / scale
    out[i * 3 + 1] = (p.y - cy) / scale
    out[i * 3 + 2] = (p.z - cz) / scale
  }
  return out
}

/**
 * Cosine similarity in [-1, 1]. Two identical descriptors → 1. Descriptors
 * of different length or with zero norm → 0 (safe default that will never
 * trip a FACE_MISMATCH flag on a garbage input).
 */
export function similarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    const va = a[i]!
    const vb = b[i]!
    dot += va * vb
    na += va * va
    nb += vb * vb
  }
  if (na === 0 || nb === 0) return 0
  return dot / Math.sqrt(na * nb)
}

/** Serialize a descriptor for transport (JSON). */
export function serializeDescriptor(d: Float32Array): number[] {
  return Array.from(d)
}

export function deserializeDescriptor(a: unknown): Float32Array | null {
  if (!Array.isArray(a)) return null
  const out = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) {
    const n = a[i]
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    out[i] = n
  }
  return out
}

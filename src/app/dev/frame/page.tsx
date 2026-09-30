import { notFound } from 'next/navigation'

import { devBypassEnabled } from '@/lib/auth/dev-bypass'

/**
 * LOCAL DEV ONLY — renders another dev page inside a fixed-width iframe so
 * phone layouts can be screenshotted (headless Chrome on Windows won't make
 * a window narrower than ~500px). /dev/frame?src=/dev/student&w=390&h=2200
 */
export default async function DevFrame({ searchParams }: { searchParams: Promise<{ src?: string; w?: string; h?: string }> }) {
  if (!devBypassEnabled()) notFound()
  const { src = '/dev/student', w = '390', h = '2000' } = await searchParams
  if (!src.startsWith('/dev/')) notFound()
  return (
    <div style={{ padding: 0, margin: 0, background: '#e2e8f0' }}>
      <iframe title="preview" src={src} width={Number(w)} height={Number(h)} style={{ border: 0, display: 'block', background: 'white' }} />
    </div>
  )
}

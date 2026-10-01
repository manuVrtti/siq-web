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
  if (!src.startsWith('/dev/') && src !== '/login') notFound()
  return (
    <div style={{ padding: 0, margin: 0, background: '#e2e8f0' }}>
      <iframe id="siq-frame" title="preview" src={src} width={Number(w)} height={Number(h)} style={{ border: 0, display: 'block', background: 'white' }} />
      {/* Reports the framed page's scroll size in the title, for overflow checks. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){try{var d=document.getElementById('siq-frame').contentDocument.documentElement;document.title='H='+d.scrollHeight+' W='+d.scrollWidth}catch(e){document.title='ERR'}},4000)`,
        }}
      />
    </div>
  )
}

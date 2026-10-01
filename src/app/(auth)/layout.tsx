import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import { LOGIN_CHAPTERS } from '@/components/story/chapters'
import { MobileIntro } from '@/components/story/mobile-intro'
import { StoryPlayer } from '@/components/story/story-player'
import { getCurrentUser } from '@/lib/auth/get-current-user'

/**
 * Auth layout — form on the left; on the right, "story mode": the product
 * told in four animated chapters (assigned → take it → results → improve),
 * so the first screen says what SelectIQ is.
 * The panel is hidden on phones; the form takes the whole screen there.
 *
 * Anyone already signed in is bounced to /select-org.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (user) redirect('/select-org')

  return (
    <main className="grid min-h-dvh grid-cols-1 lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
      <div className="bg-background flex min-h-0 flex-col px-6 py-6 sm:px-12 lg:py-7">
        <div className="flex items-center gap-2">
          <BrandMark className="size-8" />
          <span className="font-display text-base font-semibold tracking-tight">SelectIQ</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-8 lg:py-4 lg:[@media(max-height:700px)]:scale-[0.9] lg:[@media(max-height:620px)]:scale-[0.8]">
          {children}
          <MobileIntro chapters={LOGIN_CHAPTERS} />
        </div>
        <p className="text-muted-foreground text-xs">© {new Date().getFullYear()} SelectIQ · Assessment platform for engineering colleges</p>
      </div>

      <aside className="bg-primary relative hidden min-h-0 overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-8">
        <div className="siq-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="bg-highlight/20 pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -top-32 -left-20 size-80 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative mx-auto w-full max-w-md origin-center [@media(max-height:860px)]:scale-[0.9] [@media(max-height:760px)]:scale-[0.8] [@media(max-height:660px)]:scale-[0.7] [@media(max-height:580px)]:scale-[0.62]">
          <StoryPlayer chapters={LOGIN_CHAPTERS} />
          <div className="mt-6 flex items-center gap-2 text-xs text-white/70">
            <ShieldCheck className="size-4" aria-hidden />
            Proctored in a secure browser · results only your college can see
          </div>
        </div>
      </aside>
    </main>
  )
}

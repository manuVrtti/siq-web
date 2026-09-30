import { redirect } from 'next/navigation'
import { CalendarClock, CheckCircle2, Clock, ListChecks, ShieldCheck, TrendingUp } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import { getCurrentUser } from '@/lib/auth/get-current-user'

/**
 * Auth layout — form on the left, a brand panel on the right that shows the
 * actual product (a next-exam card, a result, a standing bar) rather than
 * decorative blobs, so the first screen says what SelectIQ is.
 * The panel is hidden on phones; the form takes the whole screen there.
 *
 * Anyone already signed in is bounced to /select-org.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (user) redirect('/select-org')

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="bg-background flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2">
          <BrandMark className="size-8" />
          <span className="font-display text-base font-semibold tracking-tight">SelectIQ</span>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <p className="text-muted-foreground text-xs">© {new Date().getFullYear()} SelectIQ · Assessment platform for engineering colleges</p>
      </div>

      <aside className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14 lg:py-12">
        <div className="siq-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto w-full max-w-md">
          <h2 className="text-[34px] leading-[1.1] font-semibold tracking-tight">
            Every placement test,
            <br />
            one calm place.
          </h2>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/80">
            See what&apos;s next, take it in the secure browser, and know exactly where you stand — for
            students, HODs and placement cells.
          </p>

          {/* Product glimpse */}
          <div className="relative mt-10 h-[300px]">
            <div className="absolute top-0 left-0 w-[88%] rounded-2xl bg-white p-5 text-foreground shadow-2xl shadow-black/25">
              <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Your next exam</p>
              <p className="mt-1 text-lg font-semibold">TCS NQT Mock — Round 1</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <Clock className="size-3" aria-hidden /> 90 min
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <ListChecks className="size-3" aria-hidden /> 60 questions
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                  <CalendarClock className="size-3" aria-hidden /> Opens in 1 day
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {['01', '04', '32'].map((v, i) => (
                    <span key={i} className="rounded-lg bg-highlight-tint px-2 py-1 text-center text-sm font-semibold text-primary tabular-nums">
                      {v}
                    </span>
                  ))}
                </div>
                <span className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white">Start exam →</span>
              </div>
            </div>

            <div className="absolute right-0 bottom-10 w-[62%] rotate-[1.5deg] rounded-2xl bg-white p-4 text-foreground shadow-2xl shadow-black/25">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success" aria-hidden />
                <p className="text-sm font-semibold">Accenture Mock</p>
                <span className="ml-auto rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success">88% · passed</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[92%] rounded-full bg-primary" />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Ahead of <b className="text-foreground">92%</b> of 412 candidates
              </p>
            </div>

            <div className="absolute bottom-0 left-6 flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-xs backdrop-blur-sm">
              <TrendingUp className="size-4" aria-hidden />
              Strongest: Quantitative Aptitude · 91%
            </div>
          </div>

          <div className="mt-10 flex items-center gap-2 text-xs text-white/75">
            <ShieldCheck className="size-4" aria-hidden />
            Proctored in a secure browser · results only your college can see
          </div>
        </div>
      </aside>
    </main>
  )
}

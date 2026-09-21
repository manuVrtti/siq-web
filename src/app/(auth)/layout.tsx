import { redirect } from 'next/navigation'

import { BrandMark } from '@/components/brand/mark'
import { getCurrentUser } from '@/lib/auth/get-current-user'

/**
 * Plan 004/008 — layout for unauthenticated pages, redesigned in plan 019.
 *
 * Two-column on desktop: form on the left, a quiet "brand" panel on the
 * right so the first thing anyone sees is intentional, not just a card on
 * a gray field. Stacks to a single column on phones.
 *
 * Anyone already signed in is bounced to /select-org, so a valid session
 * never renders this layout.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()
  if (user) redirect('/select-org')

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Form column */}
      <div className="bg-background flex items-center justify-center p-6 sm:p-10">
        {children}
      </div>

      {/*
        Brand column — hidden on phones (form takes the whole screen).
        Uses only the tokens defined in globals.css so it re-themes in one
        place. Never a gradient bath; the depth comes from the border
        between --sidebar and --background.
      */}
      <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border relative hidden overflow-hidden border-l lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* subtle radial highlight in the top-right, sized so it never
            reads as a "gradient hero" — just a hint of depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-40 size-[520px] rounded-full opacity-40"
          style={{
            background:
              'radial-gradient(circle at center, color-mix(in oklab, var(--primary) 30%, transparent) 0%, transparent 60%)',
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <BrandMark />
          <span className="text-base font-semibold tracking-tight">SelectIQ</span>
        </div>

        <div className="relative flex flex-col gap-4">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Campus assessments,
            <br />
            proctored and graded end to end.
          </h1>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            SelectIQ is the assessment platform for Indian engineering
            colleges. Question bank, secure browser, live proctoring and
            grading — one system for placement cells, HODs and students.
          </p>
        </div>

        <div className="relative flex items-center gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} SelectIQ</span>
          <span className="text-border">·</span>
          <span>Assessment platform for engineering colleges</span>
        </div>
      </aside>
    </main>
  )
}

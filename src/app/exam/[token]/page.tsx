import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { BrandMark } from '@/components/brand/mark'
import ExamEntryOpenInSeb from '@/components/exam/exam-entry-open-in-seb'
import ExamEntryGatedStart from '@/components/exam/exam-entry-gated-start'
import { Camera, Clock, FileQuestion, Layers, Lock, Save, ShieldCheck, UserRound } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { SEB_DOWNLOAD_URL, isSecureExamBrowserRequest } from '@/lib/seb'
import { validateToken } from '@/services/exam-session'

export const metadata: Metadata = {
  title: 'Exam — SelectIQ',
  robots: { index: false, follow: false },
}

const REASON_COPY: Record<string, { title: string; body: string }> = {
  INVALID_TOKEN: { title: 'Invalid link', body: 'This exam link is not valid. Check the URL, or ask the person who sent it.' },
  WRONG_USER: {
    title: 'Signed in as the wrong account',
    body: 'This exam is assigned to a different account. Sign out and sign in again with the account this exam was sent to.',
  },
  ASSESSMENT_NOT_PUBLISHED: {
    title: 'Not ready',
    body: 'This assessment has not been published yet. Try again once your college has released it.',
  },
  ORG_PAUSED: { title: 'Access paused', body: 'Your college’s SelectIQ access is paused right now. Please contact your placement cell.' },
  NOT_OPEN: { title: 'Not yet open', body: "This exam has a scheduled start time that hasn't been reached yet." },
  CLOSED: { title: 'Closed', body: 'The window for this exam has ended.' },
  ALREADY_SUBMITTED: { title: 'Already submitted', body: 'You’ve submitted this exam. If something went wrong, your college can allow a retake.' },
}

export default async function ExamEntryPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const hs = await headers()
  const inSeb = isSecureExamBrowserRequest(hs)
  const user = await getCurrentUser()

  // Not signed in → send to login. After login, land back here.
  // (`/select-org` is the default landing; a future improvement is to preserve
  // the `next` query so the candidate can bookmark the invite link and land
  // in the exam automatically.)
  if (!user) redirect(`/login?next=${encodeURIComponent(`/exam/${token}`)}`)
  if (user.mustChangePassword) redirect('/set-password')

  const result = await validateToken(token, user.id)

  if (!result.ok) {
    const copy = REASON_COPY[result.reason]
    return (
      <ExamShell>
        <section className="siq-card siq-rise p-7 text-center">
          <span className="bg-muted mx-auto grid size-12 place-items-center rounded-2xl">
            <Lock className="text-muted-foreground size-5" aria-hidden />
          </span>
          <h1 className="font-display mt-4 text-xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm">{copy.body}</p>
        </section>
      </ExamShell>
    )
  }

  const a = result.assignment.assessment
  const started = result.assignment.status === 'STARTED'
  // Plan 018b — proctored tests verify identity before Start (server enforces it too).
  const gate = await prisma.assessmentAssignment.findUnique({
    where: { token },
    select: { assessment: { select: { proctoringEnabled: true } }, identityCheck: { select: { id: true } } },
  })
  const needsIdentity = Boolean(gate?.assessment.proctoringEnabled && !gate.identityCheck && !started)

  const facts = [
    { icon: Clock, k: 'Duration', v: `${a.durationMinutes} min` },
    { icon: FileQuestion, k: 'Questions', v: String(a.totalQuestions) },
    { icon: Layers, k: 'Sections', v: String(a.totalSections) },
  ]
  const rules = [
    { icon: Clock, text: 'The timer starts when you click Start and can’t be paused.' },
    { icon: Save, text: 'Answers save automatically as you go.' },
    { icon: UserRound, text: 'Use only this account, on one device.' },
    ...(gate?.assessment.proctoringEnabled
      ? [{ icon: Camera, text: 'Camera on: a quick identity photo before you start, and random face checks during the exam.' }]
      : []),
    { icon: ShieldCheck, text: 'Switching windows, copy-paste, screenshots and other apps are blocked or recorded for your college.' },
  ]

  return (
    <ExamShell>
      <section className="siq-card siq-rise overflow-hidden">
        <div className="from-primary to-primary/80 text-primary-foreground relative bg-gradient-to-br px-7 py-6">
          <div className="siq-dots pointer-events-none absolute inset-0 opacity-30" aria-hidden />
          <div className="relative flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium">{started ? 'In progress' : 'Ready to start'}</span>
            {gate?.assessment.proctoringEnabled ? (
              <span className="bg-highlight text-highlight-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                <Camera className="size-3" aria-hidden /> Proctored
              </span>
            ) : null}
          </div>
          <h1 className="font-display relative mt-3 text-2xl font-semibold tracking-tight">{a.title}</h1>
          {a.description ? <p className="relative mt-1 text-sm text-white/80">{a.description}</p> : null}
        </div>

        <div className="flex flex-col gap-6 p-7">
          <dl className="grid grid-cols-3 gap-3">
            {facts.map((f) => (
              <div key={f.k} className="bg-muted/50 flex items-center gap-3 rounded-xl px-3 py-3">
                <f.icon className="text-primary size-4 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <dt className="text-muted-foreground text-[11px]">{f.k}</dt>
                  <dd className="siq-numeric text-[15px] font-semibold">{f.v}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div>
            <h2 className="mb-3 text-sm font-semibold">Before you start</h2>
            <ul className="flex flex-col gap-2.5">
              {rules.map((r) => (
                <li key={r.text} className="flex items-start gap-3 text-sm">
                  <span className="bg-primary/10 text-primary grid size-7 shrink-0 place-items-center rounded-lg">
                    <r.icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="text-muted-foreground pt-1">{r.text}</span>
                </li>
              ))}
            </ul>
          </div>

          {inSeb ? (
            <ExamEntryGatedStart token={token} started={started} needsIdentity={needsIdentity} />
          ) : (
            <ExamEntryOpenInSeb token={token} examUrl={buildExamUrl(hs, token)} downloadUrl={SEB_DOWNLOAD_URL} />
          )}
        </div>
      </section>
    </ExamShell>
  )
}

/**
 * Rebuild the absolute exam URL so the candidate can paste it into the SEB.
 * Uses `NEXT_PUBLIC_APP_URL` when set (canonical prod host), else the current
 * request's forwarded host — so preview deployments and localhost still copy a
 * link that resolves in SEB.
 */
function buildExamUrl(
  hs: { get(name: string): string | null | undefined },
  token: string,
): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (() => {
      const proto = hs.get('x-forwarded-proto') ?? 'http'
      const host = hs.get('x-forwarded-host') ?? hs.get('host') ?? 'localhost:3000'
      return `${proto}://${host}`
    })()
  return `${base}/exam/${token}`
}

function ExamShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-background relative flex min-h-screen flex-col items-center justify-center gap-6 overflow-hidden p-6">
      <div className="bg-primary/10 pointer-events-none absolute -top-40 -left-40 size-[28rem] rounded-full blur-3xl" aria-hidden />
      <div className="bg-highlight/10 pointer-events-none absolute -right-40 -bottom-40 size-[28rem] rounded-full blur-3xl" aria-hidden />
      <div className="relative flex items-center gap-2">
        <BrandMark className="size-8" />
        <span className="font-display text-base font-semibold tracking-tight">SelectIQ</span>
      </div>
      <div className="relative w-full max-w-xl">
        {children}
        <p className="text-muted-foreground mt-5 text-center text-xs">
          <Link href="/select-org" className="hover:text-foreground underline underline-offset-4">
            Back to your workspace
          </Link>
        </p>
      </div>
    </main>
  )
}

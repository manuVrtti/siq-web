import type { Metadata } from 'next'
import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import ExamEntryOpenInSeb from '@/components/exam/exam-entry-open-in-seb'
import ExamEntryStart from '@/components/exam/exam-entry-start'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  NOT_OPEN: { title: 'Not yet open', body: "This exam has a scheduled start time that hasn't been reached yet." },
  CLOSED: { title: 'Closed', body: 'The window for this exam has ended.' },
  ALREADY_SUBMITTED: { title: 'Already submitted', body: 'You have already submitted this exam. It cannot be retaken.' },
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
  if (!user) redirect('/login')

  const result = await validateToken(token, user.id)

  if (!result.ok) {
    const copy = REASON_COPY[result.reason]
    return (
      <ExamShell>
        <Card>
          <CardHeader>
            <CardTitle>{copy.title}</CardTitle>
            <CardDescription>{copy.body}</CardDescription>
          </CardHeader>
        </Card>
      </ExamShell>
    )
  }

  const a = result.assignment.assessment
  const started = result.assignment.status === 'STARTED'

  return (
    <ExamShell>
      <Card>
        <CardHeader className="gap-2">
          <CardTitle>{a.title}</CardTitle>
          {a.description && <CardDescription>{a.description}</CardDescription>}
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-muted-foreground text-xs">Duration</dt>
              <dd>{a.durationMinutes} minutes</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Sections</dt>
              <dd>{a.totalSections}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Questions</dt>
              <dd>{a.totalQuestions}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Status</dt>
              <dd>{started ? 'In progress' : 'Ready to start'}</dd>
            </div>
          </dl>

          <div className="border-t pt-3">
            <h3 className="mb-2 text-sm font-medium">Before you start</h3>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>The timer begins the moment you click Start. It cannot be paused.</li>
              <li>Answers are saved automatically as you work.</li>
              <li>You may not sign in on another device — access is tied to this account.</li>
            </ul>
          </div>

          {inSeb ? (
            <ExamEntryStart token={token} started={started} />
          ) : (
            <ExamEntryOpenInSeb
              examUrl={buildExamUrl(hs, token)}
              downloadUrl={SEB_DOWNLOAD_URL}
            />
          )}
        </CardContent>
      </Card>
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
    <main className="bg-muted/30 flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {children}
        <p className="text-muted-foreground mt-4 text-center text-xs">
          <Link href="/select-org" className="underline">
            Back to your workspace
          </Link>
        </p>
      </div>
    </main>
  )
}


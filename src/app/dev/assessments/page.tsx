import { notFound } from 'next/navigation'
import { ClipboardCheck } from 'lucide-react'

import AppShell from '@/components/layout/app-shell'
import { AssessmentsBoard, type BoardItem } from '@/components/student/assessments-board'
import { PageIntro } from '@/components/student/page-intro'
import { devBypassEnabled } from '@/lib/auth/dev-bypass'
import { UserProvider } from '@/lib/auth/user-context'
import { OrgProvider } from '@/lib/org-context'

/**
 * LOCAL DEV ONLY — the student Assessments tab with sample exams in every
 * state, for design review. 404 outside `next dev`. ?tab=done etc.
 */
export default async function DevAssessmentsPreview({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!devBypassEnabled()) notFound()
  const { tab } = await searchParams
  const now = new Date()
  const iso = (days: number, hours = 0) => new Date(now.getTime() + days * 86_400_000 + hours * 3_600_000).toISOString()
  const base = { description: null, submittedAt: null, result: null, startAt: null }

  const items: BoardItem[] = [
    { ...base, id: '1', token: 'd1', bucket: 'inProgress', title: 'DSA Weekly Test — Arrays & Strings', durationMinutes: 60, questions: 5, endAt: iso(0, 5) },
    {
      ...base,
      id: '2',
      token: 'd2',
      bucket: 'open',
      title: 'Infosys Aptitude Practice',
      description: 'Quant, logical reasoning and verbal ability. Calculators are not allowed.',
      durationMinutes: 45,
      questions: 30,
      endAt: iso(5),
    },
    { ...base, id: '3', token: 'd3', bucket: 'upcoming', title: 'TCS NQT Mock — Round 1', durationMinutes: 90, questions: 60, startAt: iso(1, 3), endAt: iso(3) },
    {
      ...base,
      id: '4',
      token: 'd4',
      bucket: 'done',
      title: 'Accenture Cognitive Mock',
      durationMinutes: 50,
      questions: 40,
      endAt: iso(-3),
      submittedAt: iso(-4),
      result: { id: 'r1', status: 'GRADED', percentage: 88, passed: true },
    },
    {
      ...base,
      id: '5',
      token: 'd5',
      bucket: 'done',
      title: 'SQL Fundamentals',
      durationMinutes: 30,
      questions: 3,
      endAt: iso(-1),
      submittedAt: iso(-1),
      result: { id: 'r2', status: 'PENDING_REVIEW', percentage: 0, passed: null },
    },
    { ...base, id: '6', token: 'd6', bucket: 'missed', title: 'Wipro Elite Mock', durationMinutes: 60, questions: 45, endAt: iso(-10) },
  ]

  return (
    <UserProvider
      user={{ id: 'dev', email: 'suyash@abes.ac.in', phone: null, name: 'Suyash Gupta', avatarUrl: null, role: 'STUDENT', firebaseUid: 'dev' }}
    >
      <OrgProvider org={{ id: 'dev-org', slug: 'abes', name: 'ABES Engineering College' }}>
        <AppShell>
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <PageIntro icon={ClipboardCheck} title="Assessments" subtitle="2 waiting for you · 2 completed" />
            <AssessmentsBoard items={items} nowIso={now.toISOString()} initialTab={tab ?? 'all'} />
          </div>
        </AppShell>
      </OrgProvider>
    </UserProvider>
  )
}

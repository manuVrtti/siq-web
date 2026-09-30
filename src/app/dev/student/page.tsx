import { notFound } from 'next/navigation'

import { StudentDashboardView, type StudentDashboardData } from '@/components/dashboard/student-dashboard-view'
import AppShell from '@/components/layout/app-shell'
import { devBypassEnabled } from '@/lib/auth/dev-bypass'
import { UserProvider } from '@/lib/auth/user-context'
import { OrgProvider } from '@/lib/org-context'

/**
 * LOCAL DEV ONLY — the student dashboard with realistic sample data, for
 * design review / headless screenshots. 404 outside `next dev`.
 * ?state=empty shows the brand-new-student state.
 */
export default async function DevStudentPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (!devBypassEnabled()) notFound()
  const { state } = await searchParams
  const now = new Date()
  const iso = (days: number, hours = 0) => new Date(now.getTime() + days * 86_400_000 + hours * 3_600_000).toISOString()

  const full: StudentDashboardData = {
    firstName: 'Suyash',
    orgName: 'ABES Engineering College',
    slug: 'abes',
    nowIso: now.toISOString(),
    greeting: 'Good morning',
    open: [
      { id: 'a1', token: 'demo1', status: 'INVITED', title: 'TCS NQT Mock — Round 1', durationMinutes: 90, questions: 60, startAt: iso(1, 3), endAt: iso(3) },
      { id: 'a2', token: 'demo2', status: 'INVITED', title: 'Infosys Aptitude Practice', durationMinutes: 45, questions: 30, startAt: null, endAt: iso(5) },
      { id: 'a3', token: 'demo3', status: 'INVITED', title: 'DSA Weekly Test — Arrays & Strings', durationMinutes: 60, questions: 5, startAt: null, endAt: iso(7) },
    ],
    completed: 7,
    pendingReview: 1,
    avgPercentage: 71.4,
    bestPercentage: 88,
    passed: 5,
    decided: 6,
    trend: [
      { title: 'Diagnostic', percentage: 52 },
      { title: 'Aptitude 1', percentage: 61 },
      { title: 'DSA Weekly 1', percentage: 58 },
      { title: 'Aptitude 2', percentage: 70 },
      { title: 'DSA Weekly 2', percentage: 74 },
      { title: 'Wipro Mock', percentage: 81 },
      { title: 'Accenture Mock', percentage: 88 },
    ],
    recent: [
      { id: 'r1', title: 'Accenture Mock', status: 'GRADED', percentage: 88, passed: true, createdAt: iso(-2) },
      { id: 'r2', title: 'System Design Basics', status: 'PENDING_REVIEW', percentage: 0, passed: null, createdAt: iso(-3) },
      { id: 'r3', title: 'Wipro Mock', status: 'GRADED', percentage: 81, passed: true, createdAt: iso(-6) },
      { id: 'r4', title: 'DSA Weekly 2', status: 'GRADED', percentage: 44, passed: false, createdAt: iso(-9) },
    ],
    standing: [
      { resultId: 'r1', title: 'Accenture Mock', percentage: 88, betterThan: 92, cohort: 412 },
      { resultId: 'r3', title: 'Wipro Mock', percentage: 81, betterThan: 76, cohort: 388 },
      { resultId: 'r4', title: 'DSA Weekly 2', percentage: 44, betterThan: 31, cohort: 120 },
    ],
    strengths: [
      { tag: 'Quantitative Aptitude', percentage: 91, questions: 48 },
      { tag: 'SQL', percentage: 86, questions: 22 },
      { tag: 'Logical Reasoning', percentage: 82, questions: 35 },
    ],
    focus: [
      { tag: 'Dynamic Programming', percentage: 38, questions: 12 },
      { tag: 'Graphs', percentage: 45, questions: 9 },
      { tag: 'Operating Systems', percentage: 52, questions: 16 },
    ],
    profile: {
      percent: 55,
      next: [
        { key: 'resume', label: 'Upload your résumé', section: 'links' },
        { key: 'projects', label: 'Add a project', section: 'projects' },
        { key: 'skills', label: 'Add 5 skills', section: 'skills' },
      ],
    },
  }

  const empty: StudentDashboardData = {
    ...full,
    open: [],
    completed: 0,
    pendingReview: 0,
    avgPercentage: null,
    bestPercentage: null,
    passed: 0,
    decided: 0,
    trend: [],
    recent: [],
    standing: [],
    strengths: [],
    focus: [],
    profile: { percent: 20, next: full.profile.next },
  }

  return (
    <UserProvider
      user={{ id: 'dev', email: 'suyash@abes.ac.in', phone: null, name: 'Suyash Gupta', avatarUrl: null, role: 'STUDENT', firebaseUid: 'dev' }}
    >
      <OrgProvider org={{ id: 'dev-org', slug: 'abes', name: 'ABES Engineering College' }}>
        <AppShell>
          <StudentDashboardView data={state === 'empty' ? empty : full} />
        </AppShell>
      </OrgProvider>
    </UserProvider>
  )
}

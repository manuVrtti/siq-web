import 'server-only'

import { assessmentWhere, resultWhere, studentWhere, type Scope } from '@/lib/auth/scope'
import { prisma } from '@/lib/prisma'
import { computeCompleteness, getProfile } from '@/services/profile'
import type { CurrentUser } from '@/types/auth'

/**
 * Welcome-journey checklists. Every step's `done` comes from real data, so
 * the list ticks itself off as people actually do things — nothing to
 * "mark complete" by hand.
 */

export type Step = { key: string; title: string; body: string; href: string; cta: string; done: boolean }

export async function managerChecklist(user: CurrentUser, scope: Scope, slug: string): Promise<Step[]> {
  const base = `/${slug}`
  const orgId = scope.orgId
  const isHod = user.role === 'COLLEGE_HOD'
  const isAdmin = user.role === 'COLLEGE_ADMIN' || user.role === 'SUPER_ADMIN'

  const [departments, heads, students, tests, published, assigned, results] = await Promise.all([
    isAdmin ? prisma.department.count({ where: { orgId } }) : Promise.resolve(0),
    isAdmin ? prisma.departmentHead.count({ where: { department: { orgId } } }) : Promise.resolve(0),
    prisma.user.count({ where: studentWhere(scope) }),
    prisma.assessment.count({ where: isHod ? { orgId, departmentId: { in: scope.all ? [] : scope.departmentIds } } : assessmentWhere(scope) }),
    prisma.assessment.count({ where: { ...assessmentWhere(scope), status: 'PUBLISHED' } }),
    prisma.assessmentAssignment.count({ where: { assessment: { orgId }, user: studentWhere(scope) } }),
    prisma.result.count({ where: resultWhere(scope) }),
  ])

  const steps: Step[] = []
  if (isAdmin) {
    steps.push(
      {
        key: 'departments',
        title: 'Add your departments',
        body: 'CSE, IT, ECE… HODs and students are organised by department.',
        href: `${base}/settings`,
        cta: 'Open departments',
        done: departments > 0,
      },
      {
        key: 'hods',
        title: 'Invite your HODs',
        body: 'Each HOD manages only their department’s students, tests and results.',
        href: `${base}/settings`,
        cta: 'Add HODs',
        done: heads > 0,
      },
    )
  }
  if (isHod && !scope.all && scope.departmentIds.length === 0) {
    steps.push({
      key: 'wait',
      title: 'Get a department assigned',
      body: 'Your College Admin hasn’t given you a department yet. Once they do, your students appear here.',
      href: `${base}/dashboard`,
      cta: 'Check again',
      done: false,
    })
  }
  steps.push(
    {
      key: 'students',
      title: isHod ? 'Check your students' : 'Import your students',
      body: isHod
        ? 'Your department’s roster. Import missing students or move them in.'
        : 'Upload the roster spreadsheet, or paste emails. Add password sign-in if you like.',
      href: isHod && students > 0 ? `${base}/candidates` : `${base}/candidates/import`,
      cta: isHod && students > 0 ? 'Open candidates' : 'Import students',
      done: students > 0,
    },
    {
      key: 'test',
      title: isHod ? 'Create a department test' : 'Create your first test',
      body: 'Pick questions from the shared bank, set the duration and pass mark.',
      href: `${base}/assessments/new`,
      cta: 'New assessment',
      done: tests > 0,
    },
    {
      key: 'assign',
      title: 'Publish and assign it',
      body: 'Assign to a batch, a department or individual students. They see a countdown.',
      href: `${base}/assessments`,
      cta: 'Open assessments',
      done: published > 0 && assigned > 0,
    },
    {
      key: 'results',
      title: 'Watch results come in',
      body: 'Grades, pass rates and topic analytics update as students submit.',
      href: `${base}/analytics`,
      cta: 'Open analytics',
      done: results > 0,
    },
  )
  return steps
}

export async function studentChecklist(userId: string, orgId: string, slug: string): Promise<Step[]> {
  const base = `/${slug}`
  const [profile, assigned, submitted, graded] = await Promise.all([
    getProfile(userId),
    prisma.assessmentAssignment.count({ where: { userId, assessment: { orgId } } }),
    prisma.assessmentAssignment.count({ where: { userId, status: 'SUBMITTED', assessment: { orgId } } }),
    prisma.result.count({ where: { userId, status: 'GRADED', assessment: { orgId } } }),
  ])
  const pct = computeCompleteness(profile).percent
  return [
    {
      key: 'profile',
      title: 'Make your profile shine',
      body: `Recruiters shortlist from profiles. Yours is ${pct}% complete — add projects, skills and your résumé.`,
      href: `${base}/profile`,
      cta: 'Edit profile',
      done: pct >= 80,
    },
    {
      key: 'assessments',
      title: 'See what’s assigned',
      body: assigned ? `${assigned} test${assigned === 1 ? '' : 's'} assigned so far. Upcoming ones show a countdown.` : 'Nothing yet — your placement cell assigns tests here.',
      href: `${base}/my-assessments`,
      cta: 'Open assessments',
      done: assigned > 0,
    },
    {
      key: 'take',
      title: 'Take your first test',
      body: 'Tests open in the SelectIQ secure browser. Your answers save as you go.',
      href: `${base}/my-assessments`,
      cta: 'Go to tests',
      done: submitted > 0,
    },
    {
      key: 'analytics',
      title: 'Read your analytics',
      body: 'After grading you’ll see your strengths, gaps and how you compare.',
      href: `${base}/my-analytics`,
      cta: 'Open analytics',
      done: graded > 0,
    },
  ]
}

export async function markOnboarded(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { onboardedAt: new Date() } })
}

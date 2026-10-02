import {
  SceneBatchProgress,
  SceneCandidatePool,
  SceneCollegeDashboard,
  SceneCollegeTree,
  SceneCompanyTest,
  SceneDepartmentTest,
  SceneGovernance,
  SceneGradingQueue,
  SceneHealthMonitor,
  SceneInviteTeam,
  SceneMyDepartment,
  SceneOnboardWizard,
  ScenePlatformMap,
  SceneRosterUpload,
  SceneShortlist,
  type DeptStat,
} from '@/components/story/role-scenes'
import type { Chapter } from '@/components/story/story-player'
import { SceneAssigned, SceneInsights, SceneResult, SceneSecureBrowser } from '@/components/story/scenes'

/**
 * Story chapters, one set per role. No scene is shared between roles, and
 * each builder takes the person's real context (college, departments,
 * counts) so the story is about *their* world.
 */

/** Login page: the product in four beats, from a student's seat (nobody is signed in yet). */
export const LOGIN_CHAPTERS: Chapter[] = [
  {
    id: 'assigned',
    eyebrow: 'Assigned',
    title: 'Your placement cell sends a test.',
    body: 'It lands on your dashboard with a live countdown — no hunting through emails or WhatsApp groups.',
    art: <SceneAssigned />,
  },
  {
    id: 'secure',
    eyebrow: 'Take it',
    title: 'Sit it in SIQ-Browser.',
    body: 'A calm, distraction-free exam. Answers save as you go, and proctoring keeps everyone honest.',
    art: <SceneSecureBrowser />,
  },
  {
    id: 'result',
    eyebrow: 'Results',
    title: 'See where you stand.',
    body: 'Your score, whether you passed, and how you compare with every candidate who took it.',
    art: <SceneResult />,
  },
  {
    id: 'insights',
    eyebrow: 'Improve',
    title: 'Know exactly what to practise.',
    body: 'Topic-by-topic strengths and gaps, so your next mock is better than the last.',
    art: <SceneInsights />,
  },
]

export function studentChapters({ orgName, deptCode }: { orgName: string; deptCode?: string | null }): Chapter[] {
  return [
    {
      id: 'assigned',
      eyebrow: 'Your tests',
      title: `${orgName} sends you tests.`,
      body: `When your placement cell${deptCode ? ` or your ${deptCode} HOD` : ''} assigns a test, it appears on your dashboard and in Assessments with a countdown.`,
      art: <SceneAssigned from={`${orgName}`} />,
    },
    {
      id: 'secure',
      eyebrow: 'Take it',
      title: 'Take it in SIQ-Browser.',
      body: 'Tests open in the SelectIQ app. Your answers save automatically — a dropped connection never loses work.',
      art: <SceneSecureBrowser />,
    },
    {
      id: 'result',
      eyebrow: 'Results',
      title: 'Results, the moment they’re graded.',
      body: 'Score, pass mark and where you stand in your batch — all under My results.',
      art: <SceneResult />,
    },
    {
      id: 'insights',
      eyebrow: 'Improve',
      title: 'Your Analytics tab coaches you.',
      body: 'Strong topics, weak topics and your trend over time, updated after every test.',
      art: <SceneInsights />,
    },
  ]
}

export function collegeAdminChapters({ orgName, departments }: { orgName: string; departments: DeptStat[] }): Chapter[] {
  const codes = departments.map((x) => x.code)
  return [
    {
      id: 'structure',
      eyebrow: 'Organise',
      title: departments.length ? `${orgName}, organised.` : 'Set up your departments.',
      body: departments.length
        ? `${codes.join(', ')} — each with its own HOD, students and tests. You see all of it.`
        : 'Create CSE, IT, ECE… HODs and students are organised by department; you see the whole college.',
      art: <SceneCollegeTree orgName={orgName} departments={departments} />,
    },
    {
      id: 'roster',
      eyebrow: 'Students',
      title: 'Bring your whole roster in.',
      body: 'Upload the spreadsheet once. Students land in their departments and sign in with the same email — or you hand out passwords.',
      art: <SceneRosterUpload codes={codes} />,
    },
    {
      id: 'team',
      eyebrow: 'Your team',
      title: 'Invite your HODs and co-admins.',
      body: 'Give each HOD their department. Add a second College Admin so the college is never locked out.',
      art: <SceneInviteTeam codes={codes} />,
    },
    {
      id: 'dashboard',
      eyebrow: 'Results',
      title: 'Placement readiness, college-wide.',
      body: 'Compare departments, batches and tests — and know which topics to fix before the real drives.',
      art: <SceneCollegeDashboard codes={codes} />,
    },
  ]
}

export function hodChapters({ departments }: { departments: DeptStat[] }): Chapter[] {
  const code = departments[0]?.code ?? 'CSE'
  return [
    {
      id: 'mine',
      eyebrow: departments.length > 1 ? 'Your departments' : 'Your department',
      title: departments.length ? `Everything here is ${departments.map((x) => x.code).join(' + ')}.` : 'Everything here is your department.',
      body: 'Students, batches, tests and results — only for the departments your College Admin gave you.',
      art: <SceneMyDepartment departments={departments} />,
    },
    {
      id: 'test',
      eyebrow: 'Tests',
      title: 'Run your own department tests.',
      body: 'Build from the shared question bank and assign to your batches. Only your department’s HODs can change them.',
      art: <SceneDepartmentTest code={code} />,
    },
    {
      id: 'grade',
      eyebrow: 'Grading',
      title: 'Review what needs a human.',
      body: 'Subjective answers from your students queue up for you. Grade them and results update straight away.',
      art: <SceneGradingQueue />,
    },
    {
      id: 'progress',
      eyebrow: 'Progress',
      title: 'Watch your batches improve.',
      body: 'Batch-by-batch trends and the weakest topics, so you know what to teach next.',
      art: <SceneBatchProgress code={code} />,
    },
  ]
}

export function superAdminChapters({ colleges }: { colleges: number }): Chapter[] {
  return [
    {
      id: 'platform',
      eyebrow: 'Platform',
      title: 'Every college, one console.',
      body: 'You run SelectIQ: every college, every admin, HOD, student and recruiter — from the Platform console.',
      art: <ScenePlatformMap colleges={colleges} />,
    },
    {
      id: 'onboard',
      eyebrow: 'Onboard',
      title: 'A new college, live in minutes.',
      body: 'One wizard: the college, its first College Admins and its departments. They take it from there.',
      art: <SceneOnboardWizard />,
    },
    {
      id: 'health',
      eyebrow: 'Monitor',
      title: 'Spot problems before colleges do.',
      body: 'Colleges without an admin, without departments or gone quiet — counted, filtered and one click away.',
      art: <SceneHealthMonitor />,
    },
    {
      id: 'govern',
      eyebrow: 'Govern',
      title: 'Full control, fully recorded.',
      body: 'Suspend an account or a whole college, grant Super Admin, change roles — reversible, and all in the audit log.',
      art: <SceneGovernance />,
    },
  ]
}

export function recruiterChapters({ orgName }: { orgName: string }): Chapter[] {
  return [
    {
      id: 'test',
      eyebrow: 'Assess',
      title: 'Your screening test, your way.',
      body: 'Coding, fundamentals and aptitude in one proctored test, with your own pass mark.',
      art: <SceneCompanyTest orgName={orgName} />,
    },
    {
      id: 'pool',
      eyebrow: 'Reach',
      title: 'Candidates from many campuses.',
      body: 'The same test across colleges gives you one fair ranking instead of a pile of résumés.',
      art: <SceneCandidatePool />,
    },
    {
      id: 'shortlist',
      eyebrow: 'Shortlist',
      title: 'Shortlist on evidence.',
      body: 'Scores, topic strengths and integrity flags side by side — pick who goes to interview.',
      art: <SceneShortlist />,
    },
  ]
}

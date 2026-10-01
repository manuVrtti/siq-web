import type { Chapter } from '@/components/story/story-player'
import {
  SceneAssigned,
  SceneBuild,
  SceneDepartments,
  SceneHodTeam,
  SceneImport,
  SceneInsights,
  SceneResult,
  SceneSecureBrowser,
} from '@/components/story/scenes'

/** The login page's story: the product in four beats, from a student's seat. */
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
    title: 'Sit it in the secure browser.',
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

export const STUDENT_CHAPTERS: Chapter[] = [
  { ...LOGIN_CHAPTERS[0]!, title: 'Tests come to you.', body: 'When your college assigns a test it appears on your dashboard and in Assessments, with a countdown to when it opens.' },
  { ...LOGIN_CHAPTERS[1]!, title: 'Take it in the secure browser.', body: 'Tests open in the SelectIQ app. Your answers save automatically — a dropped connection never loses work.' },
  { ...LOGIN_CHAPTERS[2]!, title: 'Results, the moment they’re graded.', body: 'Score, pass mark and where you stand in your batch — all under My results.' },
  { ...LOGIN_CHAPTERS[3]!, title: 'Your Analytics tab coaches you.', body: 'Strong topics, weak topics and your trend over time, updated after every test.' },
]

export const ADMIN_CHAPTERS: Chapter[] = [
  {
    id: 'departments',
    eyebrow: 'Organise',
    title: 'Set up departments and HODs.',
    body: 'Create CSE, IT, ECE… and give each an HOD. HODs run their department; you see the whole college.',
    art: <SceneDepartments />,
  },
  {
    id: 'import',
    eyebrow: 'Students',
    title: 'Bring in your students in one go.',
    body: 'Upload the roster spreadsheet. Students sign in with the same email — or you hand out passwords.',
    art: <SceneImport />,
  },
  {
    id: 'build',
    eyebrow: 'Test',
    title: 'Build, publish, assign.',
    body: 'Pick questions from the shared bank, set a pass mark, and assign to a batch or a whole department.',
    art: <SceneBuild />,
  },
  {
    id: 'results',
    eyebrow: 'Results',
    title: 'Results and analytics, live.',
    body: 'Pass rates, score spreads and the topics your students struggle with — by test, batch and department.',
    art: <SceneResult />,
  },
]

export const HOD_CHAPTERS: Chapter[] = [
  {
    id: 'team',
    eyebrow: 'Your department',
    title: 'Everything here is your department.',
    body: 'Students, batches, tests and results — scoped to the departments your College Admin gave you.',
    art: <SceneHodTeam />,
  },
  { ...ADMIN_CHAPTERS[2]!, title: 'Run your own tests.', body: 'Build department tests from the shared question bank and assign them to your students or batches.' },
  { ...ADMIN_CHAPTERS[3]!, title: 'Track your students.', body: 'Results, grading and analytics for your department — including college-wide tests your students took.' },
  {
    id: 'improve',
    eyebrow: 'Improve',
    title: 'See what to teach next.',
    body: 'Topic-level analytics show where your department is strong and where it needs practice.',
    art: <SceneInsights />,
  },
]

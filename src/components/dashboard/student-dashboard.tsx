import { StudentDashboardView, type StudentDashboardData } from '@/components/dashboard/student-dashboard-view'
import { firstName, greeting } from '@/lib/format'
import { getStudentInsights, getStudentOverview } from '@/services/analytics/candidate-analytics'
import { computeCompleteness, getProfile } from '@/services/profile'
import { getStudentCompetencyView } from '@/services/competency/student-view'

/**
 * Student dashboard — loader. Fetches, shapes plain JSON, and hands it to
 * the pure StudentDashboardView (which is also rendered with sample data at
 * /dev/student for design review).
 */
export async function StudentDashboard({
  orgId,
  orgName,
  userId,
  userName,
  slug,
}: {
  orgId: string
  orgName: string
  userId: string
  userName: string | null
  slug: string
}) {
  const [s, insights, profile, view] = await Promise.all([
    getStudentOverview(orgId, userId),
    getStudentInsights(orgId, userId),
    getProfile(userId),
    getStudentCompetencyView(userId, orgId),
  ])
  const completeness = computeCompleteness(profile)

  const data: StudentDashboardData = {
    firstName: firstName(userName),
    orgName,
    slug,
    nowIso: new Date().toISOString(),
    greeting: greeting(),
    open: s.open.map((a) => ({
      id: a.id,
      token: a.token,
      status: a.status,
      title: a.assessment.title,
      durationMinutes: a.assessment.durationMinutes,
      questions: a.assessment.sections.reduce((n, sec) => n + sec._count.questions, 0),
      startAt: a.assessment.startAt?.toISOString() ?? null,
      endAt: a.assessment.endAt?.toISOString() ?? null,
    })),
    completed: s.completed,
    pendingReview: s.pendingReview,
    avgPercentage: s.avgPercentage,
    bestPercentage: s.bestPercentage,
    passed: s.passed,
    decided: s.decided,
    trend: s.trend.map((t) => ({ title: t.title, percentage: t.percentage })),
    recent: s.recent.map((r) => ({
      id: r.id,
      title: r.assessment.title,
      status: r.status,
      percentage: r.percentage,
      passed: r.passed,
      createdAt: r.createdAt.toISOString(),
    })),
    standing: insights.standing,
    // Plan 027 — topic/skill competency once the student has a profile;
    // free-form tags until then.
    strengths: view.hasProfile
      ? view.strengths.slice(0, 3).map((x) => ({ tag: x.name, percentage: x.score, questions: x.questions }))
      : insights.strengths,
    focus: view.hasProfile
      ? view.focus.slice(0, 3).map((f) => {
          const k = view.topics.flatMap((t) => t.skills).find((sk) => sk.id === f.skillId)
          return { tag: f.skillName, percentage: f.score ?? 0, questions: k?.questions ?? 0 }
        })
      : insights.focus,
    profile: {
      percent: completeness.percent,
      next: completeness.items
        .filter((i) => !i.done)
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((i) => ({ key: i.key, label: i.label, section: i.section })),
    },
  }

  return <StudentDashboardView data={data} />
}

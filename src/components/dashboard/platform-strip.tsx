import { Building2, FileCheck2, GraduationCap, Layers } from 'lucide-react'

import { StatCard } from '@/components/analytics/stat-card'
import { getPlatformOverview } from '@/services/analytics/org-analytics'

/**
 * Plan 019 — platform-wide numbers, shown above the org dashboard for
 * SUPER_ADMIN only. The page checks the role before rendering this; the
 * matching API (/api/analytics/platform) enforces it independently.
 */
export async function PlatformStrip() {
  const p = await getPlatformOverview()
  return (
    <section className="flex flex-col gap-3">
      <p className="siq-eyebrow">Platform · all organisations</p>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Organisations" value={p.orgs} icon={Building2} />
        <StatCard
          label="Users"
          value={p.totalUsers.toLocaleString('en-IN')}
          hint={`${(p.users.STUDENT ?? 0).toLocaleString('en-IN')} students`}
          icon={GraduationCap}
        />
        <StatCard label="Assessments" value={p.assessments} icon={Layers} />
        <StatCard
          label="Submissions (7d)"
          value={p.submittedThisWeek}
          hint={`${p.graded.toLocaleString('en-IN')} graded all-time`}
          icon={FileCheck2}
        />
      </div>
    </section>
  )
}

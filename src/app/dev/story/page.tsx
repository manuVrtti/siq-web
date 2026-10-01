import { notFound } from 'next/navigation'

import {
  collegeAdminChapters,
  hodChapters,
  recruiterChapters,
  studentChapters,
  superAdminChapters,
} from '@/components/story/chapters'
import { devBypassEnabled } from '@/lib/auth/dev-bypass'

/** LOCAL DEV ONLY — every role's story scenes side by side, for design review. */
export default function DevStoryPreview() {
  if (!devBypassEnabled()) notFound()
  const depts = [
    { code: 'CSE', students: 412 },
    { code: 'IT', students: 380 },
    { code: 'ECE', students: 296 },
  ]
  const roles = [
    { role: 'Student', chapters: studentChapters({ orgName: 'ABES Engineering College', deptCode: 'CSE' }) },
    { role: 'College Admin', chapters: collegeAdminChapters({ orgName: 'ABES Engineering College', departments: depts }) },
    { role: 'HOD', chapters: hodChapters({ departments: [depts[0]!] }) },
    { role: 'Super Admin', chapters: superAdminChapters({ colleges: 1 }) },
    { role: 'Recruiter', chapters: recruiterChapters({ orgName: 'Acme Technologies' }) },
  ]
  return (
    <main className="flex flex-col gap-6 p-4">
      {roles.map((r) => (
        <section key={r.role}>
          <h2 className="mb-2 text-sm font-semibold">{r.role}</h2>
          <div className="grid grid-cols-4 gap-4">
            {r.chapters.map((c) => (
              <div key={c.id} className="bg-primary rounded-2xl p-5 text-white">
                <p className="mb-3 text-xs text-white/70">{c.title}</p>
                {c.art}
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

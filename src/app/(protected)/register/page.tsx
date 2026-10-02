import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { BarChart3, ClipboardCheck, MonitorCheck, UserRoundCheck } from 'lucide-react'

import { BrandMark } from '@/components/brand/mark'
import { RegistrationForm } from '@/components/profile/registration-form'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getUserOrgs } from '@/lib/auth/org-access'
import { DEGREES, graduationYears } from '@/lib/validators/profile'
import { pickableDepartments } from '@/services/departments'
import { collegeForEmail, getProfile, isRegistered } from '@/services/profile'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = { title: 'Create your profile — SelectIQ' }

const STEPS = [
  { icon: UserRoundCheck, title: 'Create your profile', body: 'A minute now. Add projects, skills and your résumé whenever you like.' },
  { icon: ClipboardCheck, title: 'Get assigned exams', body: 'Your placement cell assigns mock tests and drives. They appear on your dashboard with a countdown.' },
  { icon: MonitorCheck, title: 'Take them securely', body: 'Exams open in SIQ-Browser, our secure exam app. Your answers save as you go.' },
  { icon: BarChart3, title: 'See where you stand', body: 'Scores, how you compare with your batch, and the topics to practise next.' },
]

/**
 * Registration step — the first screen after a student's first sign-in
 * (ABtalks pattern: sign in → registration → where you were going).
 * Staff never see it; registered students are sent straight on.
 */
export default async function RegisterPage() {
  const user = (await getCurrentUser())!
  if (user.role !== 'STUDENT' || (await isRegistered(user.id))) redirect('/select-org')

  const [{ profile }, orgs] = await Promise.all([getProfile(user.id), getUserOrgs(user.id)])
  // The college they're joining: an existing (imported) membership, or the
  // one their email domain will match on submit.
  const college = orgs.find((o) => o.type === 'COLLEGE') ?? (await collegeForEmail(user.email))
  const placed = college
    ? await prisma.organizationMember.findFirst({ where: { userId: user.id, orgId: college.id, NOT: { departmentId: null } }, select: { id: true } })
    : null
  const departments = college && !placed ? await pickableDepartments(college.id) : []

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <div className="bg-background flex flex-col px-5 py-8 sm:px-12">
        <div className="flex items-center gap-2">
          <BrandMark className="size-8" />
          <span className="font-display text-base font-semibold tracking-tight">SelectIQ</span>
        </div>
        <div className="mx-auto w-full max-w-xl flex-1 py-10">
          <div className="siq-rise">
            <p className="text-primary text-sm font-semibold">Almost there</p>
            <h1 className="mt-1 text-[30px] leading-tight font-semibold tracking-tight">Create your profile</h1>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Your placement cell uses these details to match you to drives and share your results.
            </p>
          </div>
          <div className="siq-card siq-rise mt-8 p-6 sm:p-8" style={{ animationDelay: '80ms' }}>
            <RegistrationForm
              initial={{
                name: user.name ?? '',
                phone: user.phone ?? '',
                degree: profile?.degree ?? '',
                branch: profile?.branch ?? '',
                graduationYear: profile?.graduationYear ? String(profile.graduationYear) : '',
                rollNumber: profile?.rollNumber ?? '',
                departmentId: '',
              }}
              email={user.email}
              college={orgs.find((o) => o.type === 'COLLEGE')?.name ?? null}
              departments={departments}
              degrees={[...DEGREES]}
              years={graduationYears()}
            />
          </div>
        </div>
      </div>

      <aside className="bg-primary text-primary-foreground relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div className="siq-dots pointer-events-none absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto w-full max-w-sm">
          <h2 className="text-2xl leading-snug font-semibold tracking-tight">What happens next</h2>
          <ol className="mt-8 flex flex-col">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative flex gap-4 pb-8 last:pb-0">
                {i < STEPS.length - 1 ? <span className="absolute top-11 bottom-1 left-[19px] w-px bg-white/25" aria-hidden /> : null}
                <span
                  className={
                    i === 0
                      ? 'text-primary grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-lg'
                      : 'grid size-10 shrink-0 place-items-center rounded-xl bg-white/15'
                  }
                >
                  <s.icon className="size-5" aria-hidden />
                </span>
                <div className="pt-1">
                  <p className="text-sm font-semibold">
                    {s.title}
                    {i === 0 ? <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase">You are here</span> : null}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </main>
  )
}

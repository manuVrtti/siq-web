import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { BrandMark } from '@/components/brand/mark'
import { RegistrationForm } from '@/components/profile/registration-form'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getUserOrgs } from '@/lib/auth/org-access'
import { DEGREES, graduationYears } from '@/lib/validators/profile'
import { getProfile, isRegistered } from '@/services/profile'

export const metadata: Metadata = { title: 'Create your profile — SelectIQ' }

/**
 * Registration step — the first screen after a student's first sign-in
 * (ABtalks pattern: sign in → registration → where you were going).
 * Staff never see it; registered students are sent straight on.
 */
export default async function RegisterPage() {
  const user = (await getCurrentUser())!
  if (user.role !== 'STUDENT' || (await isRegistered(user.id))) redirect('/select-org')

  const [{ profile }, orgs] = await Promise.all([getProfile(user.id), getUserOrgs(user.id)])

  return (
    <main className="bg-background flex min-h-screen flex-col items-center px-4 py-10 sm:py-16">
      <div className="w-full max-w-xl">
        <div className="mb-8 flex items-center gap-2">
          <BrandMark className="size-8" />
          <span className="font-display text-base font-semibold tracking-tight">SelectIQ</span>
        </div>

        <p className="siq-eyebrow mb-2">Step 1 of 1 · takes a minute</p>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Create your profile</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your placement cell uses these details to match you to drives and share your results. You
          can add projects, skills and your résumé afterwards.
        </p>

        <div className="siq-card mt-8 p-6 sm:p-8">
          <RegistrationForm
            initial={{
              name: user.name ?? '',
              phone: user.phone ?? '',
              degree: profile?.degree ?? '',
              branch: profile?.branch ?? '',
              graduationYear: profile?.graduationYear ? String(profile.graduationYear) : '',
              rollNumber: profile?.rollNumber ?? '',
            }}
            email={user.email}
            college={orgs.find((o) => o.type === 'COLLEGE')?.name ?? null}
            degrees={[...DEGREES]}
            years={graduationYears()}
          />
        </div>
      </div>
    </main>
  )
}

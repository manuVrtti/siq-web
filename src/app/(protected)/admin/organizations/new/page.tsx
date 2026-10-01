import type { Metadata } from 'next'
import { Rocket } from 'lucide-react'

import { OnboardWizard } from '@/components/admin/onboard-wizard'
import { PageIntro } from '@/components/student/page-intro'
import { DEPARTMENT_PRESETS } from '@/services/console'

export const metadata: Metadata = { title: 'Onboard — Platform console — SelectIQ' }

export default function OnboardOrganizationPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageIntro icon={Rocket} title="Onboard an organization" subtitle="A college (or company), its first College Admins and departments — in one go." />
      <OnboardWizard presets={DEPARTMENT_PRESETS.map((d) => ({ ...d }))} />
    </div>
  )
}

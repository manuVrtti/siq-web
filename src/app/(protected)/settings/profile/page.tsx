import type { Metadata } from 'next'

import PageHeader from '@/components/ui/page-header'

import ProfileForm from './profile-form'

export const metadata: Metadata = { title: 'Profile — SelectIQ' }

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" description="Your name and photo." />
      <ProfileForm />
    </>
  )
}

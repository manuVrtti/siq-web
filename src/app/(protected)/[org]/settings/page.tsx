import { redirect } from 'next/navigation'

/** Settings moved into the College Admin panel. */
export default async function SettingsRedirect({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  redirect(`/${org}/manage/departments`)
}

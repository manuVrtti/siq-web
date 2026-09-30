import { redirect } from 'next/navigation'

/**
 * No marketing page yet. /login already forwards signed-in users to their
 * workspace, so the root simply goes there.
 */
export default function Home() {
  redirect('/login')
}

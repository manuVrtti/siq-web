import { notFound } from 'next/navigation'

import { AdminShell } from '@/components/admin/admin-shell'
import { getCurrentUser } from '@/lib/auth/get-current-user'

/**
 * Platform admin console — SUPER_ADMIN only. Anyone else gets 404 (never
 * confirm the console exists). Every API behind these pages re-checks the
 * role independently with withRole(['SUPER_ADMIN']).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') notFound()
  return <AdminShell userName={user.name ?? user.email ?? 'Admin'}>{children}</AdminShell>
}

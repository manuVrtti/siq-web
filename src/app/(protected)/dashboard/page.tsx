import type { Metadata } from 'next'

import RoleGate from '@/components/auth/role-gate'
import PageHeader from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/get-current-user'

export const metadata: Metadata = { title: 'Dashboard — SelectIQ' }

export default async function DashboardPage() {
  // Non-null: the layout redirects when signed out.
  const user = (await getCurrentUser())!

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name ?? user.email ?? 'there'}`}
        description={`Signed in as ${user.email ?? user.phone ?? 'unknown'} · ${user.role.replace(/_/g, ' ').toLowerCase()}`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
            <CardDescription>Details from your college or employer.</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            You are not yet linked to an organisation. Access to exams and results is
            granted by your college.
          </CardContent>
        </Card>

        {/*
          RoleGate decides what to draw, never what is permitted. The matching
          server-side check lives in /api/admin/users.
        */}
        <RoleGate allowedRoles={['COLLEGE_ADMIN', 'SUPER_ADMIN']}>
          <Card>
            <CardHeader>
              <CardTitle>Administration</CardTitle>
              <CardDescription>Visible to college admins only.</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground text-sm">
              Manage users, assessments and organisation settings.
            </CardContent>
          </Card>
        </RoleGate>
      </div>
    </>
  )
}

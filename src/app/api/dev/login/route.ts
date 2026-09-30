import { NextResponse, type NextRequest } from 'next/server'

import { DEV_USER_COOKIE, devBypassEnabled, isLocalHost } from '@/lib/auth/dev-bypass'
import { prisma } from '@/lib/prisma'

/**
 * LOCAL DEV ONLY — impersonate an existing user for screen reviews.
 *
 *   GET /api/dev/login                 → list users (id, name, role) as JSON
 *   GET /api/dev/login?as=<userId>&next=/path → set cookie, redirect
 *   GET /api/dev/login?logout=1        → clear it
 *
 * 404 unless `next dev` AND the request is from localhost. See
 * lib/auth/dev-bypass.ts for why this can never run in production.
 */

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!devBypassEnabled() || !isLocalHost(request.headers.get('host'))) {
    return new NextResponse('Not found', { status: 404 })
  }
  const p = request.nextUrl.searchParams
  const next = p.get('next')?.startsWith('/') && !p.get('next')!.startsWith('//') ? p.get('next')! : '/select-org'

  if (p.get('logout')) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.delete(DEV_USER_COOKIE)
    return res
  }

  const as = p.get('as')
  if (!as) {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      take: 50,
      select: { id: true, name: true, email: true, role: true, memberships: { select: { org: { select: { slug: true } } } } },
    })
    return NextResponse.json({ users })
  }

  const user = await prisma.user.findUnique({ where: { id: as }, select: { id: true } })
  if (!user) return new NextResponse('No such user', { status: 404 })
  const res = NextResponse.redirect(new URL(next, request.url))
  res.cookies.set(DEV_USER_COOKIE, user.id, { httpOnly: true, sameSite: 'lax', path: '/' })
  return res
}

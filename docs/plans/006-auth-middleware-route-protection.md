# Plan 006 — Auth Middleware & Route Protection

## 1. Objective

Create Next.js middleware that enforces authentication on protected routes and API endpoints, plus server-side helpers for resolving the current user.

## 2. Scope

- Next.js middleware for auth enforcement
- Route classification (public vs protected)
- `getCurrentUser()` helper for server components and API routes
- `requireAuth()` wrapper for API routes
- Redirect and 401 behaviors

### Out of Scope

- Role-based checks (Plan 07)
- Organization-scoped access (Plan 07)
- Rate limiting on API routes (basic one exists from Plan 05, comprehensive version later)

## 3. Prerequisites / Dependencies

- Plan 04 completed (session cookie infrastructure)
- Plan 03 completed (Prisma User model for user resolution)

## 4. Technical Approach

Next.js middleware runs on the Edge Runtime before every request. It reads the session cookie and makes a pass/fail decision:

- **Pages**: unauthenticated → redirect to `/login`
- **API routes**: unauthenticated → return 401 JSON
- **Public routes**: always pass through

The middleware only checks cookie existence and basic validity (not expired, proper format). Full user resolution (Prisma lookup) happens in `getCurrentUser()` within the actual route handler or server component — this avoids hitting the database on every static asset request.

## 5. Implementation Steps

1. Create `middleware.ts` at project root:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';

   const PUBLIC_ROUTES = [
     '/',
     '/login',
     '/api/auth/session',
     '/api/auth/phone/send-otp',
     '/api/auth/phone/verify-otp',
     '/api/health',
     '/api/health/db',
   ];

   const PUBLIC_PREFIXES = [
     '/_next',
     '/favicon',
     '/public',
   ];

   export function middleware(request: NextRequest) {
     const { pathname } = request.nextUrl;

     // Allow public routes and static assets
     if (PUBLIC_ROUTES.includes(pathname) ||
         PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
       return NextResponse.next();
     }

     const session = request.cookies.get('__session');

     if (!session?.value) {
       // API routes get 401, pages get redirected
       if (pathname.startsWith('/api/')) {
         return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
       }
       return NextResponse.redirect(new URL('/login', request.url));
     }

     return NextResponse.next();
   }

   export const config = {
     matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
   };
   ```
2. Create `lib/auth/get-current-user.ts`:
   ```typescript
   export async function getCurrentUser(): Promise<CurrentUser | null> {
     // 1. Read session cookie
     // 2. Verify via Firebase Admin SDK (verifySessionCookie)
     // 3. Fetch User from Prisma by firebaseUid
     // 4. Return typed CurrentUser object or null
   }
   ```
   - `CurrentUser` type includes: id, email, phone, name, avatarUrl, role, firebaseUid, memberships
3. Create `types/auth.ts`:
   ```typescript
   export interface CurrentUser {
     id: string;
     email: string | null;
     phone: string | null;
     name: string | null;
     avatarUrl: string | null;
     role: UserRole;
     firebaseUid: string;
   }
   ```
4. Create `lib/auth/require-auth.ts`:
   - For API routes: calls `getCurrentUser()`, returns 401 if null
   - Returns the `CurrentUser` object for use in the handler
   ```typescript
   export async function requireAuth(): Promise<CurrentUser> {
     const user = await getCurrentUser();
     if (!user) {
       throw new AuthError('Unauthorized');
     }
     return user;
   }
   ```
5. Update `/app/(auth)/login/page.tsx`:
   - Add server-side check: if valid session exists, redirect to `/dashboard`
6. Update `/app/(protected)/dashboard/page.tsx`:
   - Use `getCurrentUser()` to fetch and display full user data

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `middleware.ts` | Root middleware for auth |
| Create | `lib/auth/get-current-user.ts` | User resolution helper |
| Create | `types/auth.ts` | CurrentUser type |
| Create | `lib/auth/require-auth.ts` | Auth enforcement for API routes |
| Modify | `app/(auth)/login/page.tsx` | Redirect if already authed |
| Modify | `app/(protected)/dashboard/page.tsx` | Use getCurrentUser |

## 7. Testing / Verification

- [ ] Unauthenticated: visiting `/dashboard` redirects to `/login`
- [ ] Unauthenticated: calling `GET /api/health/db` returns 200 (public route)
- [ ] Unauthenticated: calling a protected API route returns 401 JSON
- [ ] Authenticated: visiting `/dashboard` loads normally with user data
- [ ] Authenticated: visiting `/login` redirects to `/dashboard`
- [ ] Expired/invalid cookie: treated as unauthenticated
- [ ] Static assets (CSS, JS, images) load without auth check
- [ ] `getCurrentUser()` returns correct user data including role
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: middleware route classification, public routes list
- Add to `CLAUDE.md`: "Use `getCurrentUser()` in server components, `requireAuth()` in API routes"
- Add to `docs/project-context.md`: Plan 06 completed, route protection active

## 9. Estimated Effort

- Claude Code execution: ~30 minutes
- Manual testing: ~10 minutes
- Documentation updates: ~5 minutes

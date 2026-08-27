# Plan 010 — Error Handling, Health Checks & Deployment

## 1. Objective

Add global error handling, health check endpoints for all services, and deploy the complete Sprint 1 skeleton to Vercel for the first time.

## 2. Scope

- Global error boundary and custom error pages
- Custom error classes and standardized API responses
- Health check endpoints for all connected services
- Vercel deployment with environment configuration
- Post-deployment verification
- Sprint 1 documentation wrap-up

### Out of Scope

- Monitoring/alerting (Sentry, Datadog, etc.)
- Structured logging (pino, winston)
- Performance monitoring
- Automated testing / CI pipeline (future sprint)
- Custom domain configuration

## 3. Prerequisites / Dependencies

- All Plans 01–09 completed
- Vercel account created
- GitHub repository pushed (remote origin set)

## 4. Technical Approach

Three concerns addressed together because they're all "production readiness" work:

**Error handling**: Custom error classes map to HTTP status codes. A standardized API response helper ensures every endpoint returns the same shape. Global error boundary catches unhandled client errors with a recovery UI.

**Health checks**: One endpoint per external service, plus an aggregate. These are the first thing you check when something breaks in production.

**Deployment**: Vercel auto-deploys from Git. The build command includes Prisma generate + migrate. Environment variables are set in Vercel dashboard.

## 5. Implementation Steps

### Error Handling

1. Update `lib/errors.ts` (may exist from Plan 07):
   ```typescript
   export class AppError extends Error {
     constructor(
       message: string,
       public statusCode: number = 500,
       public code: string = 'INTERNAL_ERROR'
     ) { super(message); }
   }

   export class AuthError extends AppError {
     constructor(message = 'Unauthorized') { super(message, 401, 'UNAUTHORIZED'); }
   }
   export class ForbiddenError extends AppError {
     constructor(message = 'Forbidden') { super(message, 403, 'FORBIDDEN'); }
   }
   export class ValidationError extends AppError {
     constructor(message: string) { super(message, 400, 'VALIDATION_ERROR'); }
   }
   export class NotFoundError extends AppError {
     constructor(message = 'Not found') { super(message, 404, 'NOT_FOUND'); }
   }
   ```
2. Create `lib/api-response.ts`:
   ```typescript
   export function successResponse<T>(data: T, status = 200) {
     return NextResponse.json({ success: true, data }, { status });
   }

   export function errorResponse(error: unknown) {
     if (error instanceof AppError) {
       return NextResponse.json(
         { success: false, error: { code: error.code, message: error.message } },
         { status: error.statusCode }
       );
     }
     // Unknown error — log and return generic 500
     console.error('Unhandled error:', error);
     return NextResponse.json(
       { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
       { status: 500 }
     );
   }
   ```
3. Wrap all existing API routes with try/catch + `errorResponse()`
4. Create `app/error.tsx` — global error boundary:
   - "Something went wrong" UI with SelectIQ branding
   - "Try again" button (calls `reset()`)
   - Link to return to dashboard
5. Create `app/not-found.tsx` — custom 404:
   - "Page not found" UI
   - Link to return to dashboard

### Health Checks

6. Create `/app/api/health/route.ts`:
   - Returns `{ status: 'ok', timestamp, version, uptime }`
   - No auth required
7. Update `/app/api/health/db/route.ts` (exists from Plan 03):
   - `prisma.$queryRaw\`SELECT 1\`` → returns `{ status: 'ok', latencyMs }`
8. Create `/app/api/health/firebase/route.ts`:
   - Verify Firebase Admin SDK initialized: `adminAuth.listUsers(1)`
   - Returns `{ status: 'ok' }` or `{ status: 'error', message }`
9. Create `/app/api/health/storage/route.ts`:
   - List files in `avatars` bucket (empty is fine)
   - Returns `{ status: 'ok' }` or `{ status: 'error', message }`
10. Create `/app/api/health/all/route.ts`:
    - Calls all health checks in parallel
    - Returns aggregate: `{ status: 'ok' | 'degraded', services: { db, firebase, storage } }`
    - `degraded` if any one service is down but others work

### Deployment

11. Vercel project setup:
    - Connect GitHub repo to Vercel
    - Framework preset: Next.js (auto-detected)
    - Build command: `prisma generate && prisma migrate deploy && next build`
    - Output directory: `.next` (default)
    - Node.js version: 18.x or 20.x
12. Set all environment variables in Vercel dashboard:
    - Copy every key from `.env.local`
    - Ensure `FIREBASE_PRIVATE_KEY` is properly formatted (newlines as `\n`)
    - Set `DATABASE_URL` to Supabase pooler connection string (for serverless)
13. Trigger first deploy (push to main or manual deploy)
14. Post-deployment checklist:
    - Update Firebase Console: add Vercel domain to authorized domains
    - Update GitHub OAuth app: add Vercel domain to callback URLs
    - Update Google OAuth consent screen: add Vercel domain
15. Verify on production URL:
    - All health checks pass
    - Google sign-in works
    - GitHub sign-in works
    - Phone OTP works
    - Protected routes enforce auth
    - File upload works
    - Sidebar navigation works
    - Mobile responsive layout works

### Documentation

16. Update `docs/project-context.md`:
    - Sprint 1 completion summary
    - Deployed URL
    - All 10 plans marked complete
    - Known limitations / deferred items
17. Update `CLAUDE.md`:
    - Error handling patterns (`AppError`, `successResponse`, `errorResponse`)
    - API response format
    - Health check endpoints
    - Deployment notes (build command, env vars)
    - Sprint 1 architecture summary

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Update | `lib/errors.ts` | Full error class hierarchy |
| Create | `lib/api-response.ts` | Standardized responses |
| Modify | All API routes | Add try/catch + errorResponse |
| Create | `app/error.tsx` | Global error boundary |
| Create | `app/not-found.tsx` | Custom 404 |
| Create | `app/api/health/route.ts` | Liveness check |
| Create | `app/api/health/firebase/route.ts` | Firebase check |
| Create | `app/api/health/storage/route.ts` | Storage check |
| Create | `app/api/health/all/route.ts` | Aggregate check |
| Modify | `package.json` | Build command for Vercel |
| Update | `docs/project-context.md` | Sprint 1 wrap-up |
| Update | `CLAUDE.md` | Patterns and deployment |

## 7. Testing / Verification

### Local
- [ ] Throw error in a page → error boundary catches and shows recovery UI
- [ ] Visit non-existent route → custom 404 page
- [ ] API error returns `{ success: false, error: { code, message } }`
- [ ] All health checks return `{ status: 'ok' }`
- [ ] `npm run build` passes

### Production (Post-Deploy)
- [ ] `GET /api/health/all` → all services `ok`
- [ ] Google sign-in → success → dashboard
- [ ] GitHub sign-in → success → dashboard
- [ ] Phone OTP → success → dashboard
- [ ] Upload avatar → displays in top bar
- [ ] Student role → can't see admin nav items
- [ ] Mobile layout → sidebar drawer works
- [ ] Direct URL to protected page → redirects to login if not authed

## 8. Documentation Updates

- Full Sprint 1 summary in `docs/project-context.md`
- Error handling and API response patterns in `CLAUDE.md`
- Deployment runbook added to `docs/plans/` or `CLAUDE.md`

## 9. Estimated Effort

- Claude Code execution: ~35 minutes
- Vercel setup: ~15 minutes (manual, dashboard config)
- Firebase/OAuth config updates: ~10 minutes (manual)
- Production testing: ~20 minutes
- Documentation updates: ~15 minutes

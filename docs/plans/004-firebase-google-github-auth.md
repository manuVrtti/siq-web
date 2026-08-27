# Plan 004 — Firebase Auth — Google & GitHub OAuth

## 1. Objective

Implement sign-in with Google and GitHub using Firebase Auth on the client, with server-side session management via HTTP-only cookies and automatic user upsert in Prisma.

## 2. Scope

- Initialize Firebase client SDK and Admin SDK
- Build login page with Google and GitHub sign-in buttons
- Server-side session cookie creation and verification
- Upsert user record in Prisma on every login
- Logout flow (clear cookie + Firebase sign-out)

### Out of Scope

- Phone OTP authentication (Plan 05)
- Route protection middleware (Plan 06)
- Role-based access control (Plan 07)
- UI styling beyond functional layout (Plan 08)

## 3. Prerequisites / Dependencies

- Plan 02 completed (Firebase env vars validated)
- Plan 03 completed (User model exists in Prisma)
- Firebase project created with Google and GitHub providers enabled in Firebase Console
- GitHub OAuth app created (client ID + secret configured in Firebase Console)

## 4. Technical Approach

Firebase handles OAuth complexity (token exchange, refresh, provider linking). The flow:

1. User clicks Google/GitHub button → Firebase popup OAuth
2. Client receives Firebase ID token
3. Client POSTs ID token to `/api/auth/session`
4. Server verifies token via Firebase Admin SDK
5. Server upserts User in Prisma (create on first login, update lastLoginAt on return)
6. Server sets HTTP-only session cookie (Firebase session cookie, 5-day expiry)
7. Subsequent requests read cookie → verify → resolve user

This approach keeps auth state server-side (secure, no client-side token storage) while using Firebase for the OAuth heavy lifting.

## 5. Implementation Steps

1. Install Firebase SDKs:
   - `npm install firebase` (client)
   - `npm install firebase-admin` (server)
2. Create `lib/firebase/client.ts`:
   - Initialize Firebase app with `NEXT_PUBLIC_FIREBASE_*` config
   - Export `auth` instance (`getAuth()`)
   - Export provider instances (`GoogleAuthProvider`, `GithubAuthProvider`)
3. Create `lib/firebase/admin.ts`:
   - Initialize Firebase Admin with service account credentials from env
   - Use singleton pattern (check `admin.apps.length` before init)
   - Export `adminAuth` (`admin.auth()`)
4. Create `lib/auth/session.ts`:
   - `createSessionCookie(idToken)` — calls `adminAuth.createSessionCookie()` with 5-day expiry
   - `verifySessionCookie(cookie)` — calls `adminAuth.verifySessionCookie()`, returns decoded claims
   - `getSessionCookie()` — reads cookie from `cookies()` (Next.js)
   - Cookie name: `__session` (Firebase convention)
5. Create `/app/api/auth/session/route.ts`:
   - **POST**: receive `{ idToken }` → verify → create session cookie → upsert User in Prisma:
     ```typescript
     const user = await prisma.user.upsert({
       where: { firebaseUid: decodedToken.uid },
       update: { lastLoginAt: new Date(), name, email, avatarUrl },
       create: { firebaseUid: uid, email, name, avatarUrl, role: 'STUDENT' },
     });
     ```
     → set cookie → return `{ user }`
   - **DELETE**: clear session cookie → return `{ success: true }`
6. Create `/app/(auth)/layout.tsx`:
   - Centered card layout
   - If user already has valid session, redirect to `/dashboard`
7. Create `/app/(auth)/login/page.tsx`:
   - "Sign in with Google" button → `signInWithPopup(auth, googleProvider)`
   - "Sign in with GitHub" button → `signInWithPopup(auth, githubProvider)`
   - On success: get ID token → POST to `/api/auth/session` → redirect to `/dashboard`
   - Loading states during OAuth flow
   - Error handling (popup blocked, account exists with different provider, etc.)
8. Create a minimal `/app/(protected)/dashboard/page.tsx`:
   - Server component that reads session cookie
   - Displays "Welcome, {user.name}" (proves auth round-trip works)
   - "Sign out" button that calls DELETE `/api/auth/session` + `signOut(auth)` + redirect to `/login`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Install | `firebase`, `firebase-admin` | Firebase SDKs |
| Create | `lib/firebase/client.ts` | Client SDK init |
| Create | `lib/firebase/admin.ts` | Admin SDK init |
| Create | `lib/auth/session.ts` | Session cookie helpers |
| Create | `app/api/auth/session/route.ts` | Session create/destroy endpoints |
| Create | `app/(auth)/layout.tsx` | Auth page layout |
| Create | `app/(auth)/login/page.tsx` | Login page with OAuth buttons |
| Create | `app/(protected)/dashboard/page.tsx` | Minimal protected page |

## 7. Testing / Verification

- [ ] Google sign-in: popup opens → consent → redirect to dashboard → shows user name
- [ ] GitHub sign-in: popup opens → authorize → redirect to dashboard → shows user name
- [ ] Session persists: close tab → reopen `/dashboard` → still logged in
- [ ] Sign out: click logout → redirected to `/login` → `/dashboard` no longer accessible
- [ ] User record created in Prisma (check via `npx prisma studio`)
- [ ] Second login updates `lastLoginAt` (doesn't create duplicate)
- [ ] Error case: popup blocked → shows user-friendly error message
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: Firebase auth flow diagram, session cookie name and expiry, upsert pattern
- Add to `CLAUDE.md`: "Firebase handles ALL authentication. Never bypass Firebase for auth."
- Add to `docs/project-context.md`: Plan 04 completed, Google + GitHub OAuth functional

## 9. Estimated Effort

- Claude Code execution: ~45 minutes
- Manual testing: ~15 minutes (test both providers, session persistence, logout)
- Documentation updates: ~5 minutes

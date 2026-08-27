# Plan 017 — Exam Link Enforcement & Secure Browser Gateway

## 1. Objective

Implement the 3-layer exam link enforcement architecture that ensures exams can only be taken inside the Electron Secure Exam Browser, using a custom protocol, custom User-Agent, and server middleware with a gateway page.

## 2. Scope

- Custom protocol handler (`selectiq://`) link generation
- Custom User-Agent detection middleware
- Server-side enforcement on exam routes
- `/browser-required` gateway page for non-SEB access
- Deep-link handoff from web to Electron SEB
- Graceful fallback and clear messaging

### Out of Scope

- Building the Electron SEB (existing asset per stack)
- Proctoring inside the exam (Plan 18)
- Browser lockdown internals (handled by existing Electron app)

## 3. Prerequisites / Dependencies

- Plan 15 complete (exam runtime exists to protect)
- Electron Secure Exam Browser (existing — sends custom User-Agent, handles `selectiq://` protocol)
- Exam link enforcement architecture already designed (per project context)

## 4. Technical Approach

Three enforcement layers work together:

1. **Custom protocol (`selectiq://`)**: Invitation links use `selectiq://exam/{token}` which the OS routes to the installed Electron SEB. A web fallback link is also provided.

2. **Custom User-Agent**: The Electron SEB sends a distinctive User-Agent string (e.g., `SelectIQ-SEB/1.0`). The web app can detect whether a request originates from the SEB.

3. **Server middleware + gateway**: Exam attempt routes check the User-Agent. Requests NOT from the SEB are redirected to `/browser-required`, which explains the requirement and offers the `selectiq://` deep link plus a download link for the SEB.

The exam *entry* page (`/exam/{token}`) is accessible in a normal browser (to show info and launch the SEB), but the exam *attempt* page (`/exam/{token}/attempt`) is SEB-only.

## 5. Implementation Steps

1. Create `lib/seb.ts` — SEB detection utilities:
   ```typescript
   export const SEB_USER_AGENT_MARKER = 'SelectIQ-SEB';

   export function isSecureExamBrowser(userAgent: string | null): boolean {
     return !!userAgent && userAgent.includes(SEB_USER_AGENT_MARKER);
   }

   export function buildProtocolLink(token: string): string {
     return `selectiq://exam/${token}`;
   }

   export function buildWebFallbackLink(token: string): string {
     return `${config.appUrl}/exam/${token}`;
   }
   ```
2. Add SEB config to env/config: SEB download URL, protocol scheme
3. Update `middleware.ts` — add exam attempt enforcement:
   ```typescript
   // For /exam/[token]/attempt routes:
   if (pathname.match(/^\/exam\/[^/]+\/attempt/)) {
     const ua = request.headers.get('user-agent');
     if (!isSecureExamBrowser(ua)) {
       const token = extractToken(pathname);
       return NextResponse.redirect(
         new URL(`/browser-required?token=${token}`, request.url)
       );
     }
   }
   ```
4. Add server-side check in exam attempt API routes (defense in depth — don't trust middleware alone):
   - `/app/api/exam/[token]/start`, `/answer`, `/submit` all verify SEB User-Agent
   - Return 403 with `{ error: 'SECURE_BROWSER_REQUIRED' }` if not SEB
5. Create `/app/browser-required/page.tsx`:
   - Clear explanation: "This exam must be taken in the SelectIQ Secure Exam Browser"
   - "Launch Secure Browser" button → `selectiq://exam/{token}` deep link
   - "Download Secure Browser" link (if not installed)
   - Detection helper text ("If nothing happens, install the browser below")
   - Retry / troubleshooting guidance
6. Update `/app/exam/[token]/page.tsx` (entry page, from Plan 15):
   - Detect if already in SEB (User-Agent):
     - In SEB → show "Start Exam" (proceeds to attempt route)
     - In normal browser → show "Launch in Secure Browser" (`selectiq://` link) + info
7. Update invitation links (Plan 13):
   - Email/SMS include the web entry link (`/exam/{token}`)
   - Entry page handles the SEB handoff
8. Add `/app/api/exam/[token]/verify-browser/route.ts`:
   - Lightweight endpoint the SEB can hit to confirm it's recognized (returns SEB detection result)

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `lib/seb.ts` | SEB detection + link builders |
| Modify | `lib/config.ts` | SEB download URL, protocol scheme |
| Modify | `middleware.ts` | Exam attempt SEB enforcement |
| Modify | `app/api/exam/[token]/start/route.ts` | SEB check |
| Modify | `app/api/exam/[token]/answer/route.ts` | SEB check |
| Modify | `app/api/exam/[token]/submit/route.ts` | SEB check |
| Create | `app/browser-required/page.tsx` | Gateway page |
| Modify | `app/exam/[token]/page.tsx` | SEB-aware entry |
| Create | `app/api/exam/[token]/verify-browser/route.ts` | Browser verification |

## 7. Testing / Verification

- [ ] Normal browser → `/exam/{token}` shows "Launch in Secure Browser"
- [ ] Normal browser → `/exam/{token}/attempt` redirects to `/browser-required`
- [ ] `/browser-required` shows launch + download options
- [ ] SEB User-Agent (simulated via header override) → attempt route accessible
- [ ] SEB → entry page shows "Start Exam" directly
- [ ] API attempt routes reject non-SEB requests (403) even if middleware bypassed
- [ ] `selectiq://exam/{token}` deep link format correct in invitations
- [ ] Protocol link launches SEB (test with actual Electron app if available)
- [ ] Clear messaging when SEB not installed
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: 3-layer enforcement (protocol + User-Agent + middleware/gateway), SEB marker, entry vs attempt route distinction
- Add to `CLAUDE.md`: "Exam attempt routes are SEB-only; enforce at both middleware AND API level"
- Add to `docs/project-context.md`: Plan 17 completed, exam link enforcement live

## 9. Estimated Effort

- Claude Code execution: ~40 minutes
- Manual testing: ~20 minutes (User-Agent simulation, deep link, gateway)
- Documentation updates: ~5 minutes

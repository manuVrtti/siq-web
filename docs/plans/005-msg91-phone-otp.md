# Plan 005 — MSG91 Phone OTP + Firebase Custom Tokens

## 1. Objective

Implement DLT-compliant phone OTP login for Indian users using MSG91 for SMS delivery and Firebase custom tokens to unify phone auth with the existing session system.

## 2. Scope

- MSG91 API wrapper (send OTP, verify OTP)
- Phone OTP API routes
- Firebase custom token minting on successful verification
- Client-side phone login UI integrated into existing login page
- Input validation for Indian phone numbers
- Basic rate limiting on OTP send

### Out of Scope

- OTP for non-Indian numbers
- SMS templates creation in MSG91 dashboard (manual prerequisite)
- WhatsApp OTP channel
- OTP for 2FA on existing accounts (this is primary auth only)

## 3. Prerequisites / Dependencies

- Plan 04 completed (Firebase auth + session infrastructure)
- Plan 02 completed (MSG91 env vars validated)
- MSG91 account set up with:
  - DLT-registered sender ID
  - DLT-approved OTP template
  - Auth key generated

## 4. Technical Approach

Firebase doesn't natively support MSG91 for SMS delivery. The bridge pattern:

1. Client sends phone number to our API
2. API calls MSG91 to send OTP (MSG91 handles DLT compliance)
3. Client sends phone + OTP to our verify API
4. API calls MSG91 to verify OTP
5. On success: upsert User in Prisma (by phone number)
6. Mint Firebase custom token: `adminAuth.createCustomToken(user.id)`
7. Return custom token to client
8. Client calls `signInWithCustomToken(auth, token)` → unified Firebase session
9. Same session cookie flow as Plan 04 (POST to `/api/auth/session`)

This keeps all auth sessions in Firebase regardless of the sign-in method.

## 5. Implementation Steps

1. Create `lib/msg91.ts`:
   ```typescript
   // MSG91 OTP API wrapper
   export async function sendOTP(phone: string): Promise<{ success: boolean; message: string }>
   // Calls MSG91 /api/v5/otp with authkey, template_id, mobile
   
   export async function verifyOTP(phone: string, otp: string): Promise<{ success: boolean; message: string }>
   // Calls MSG91 /api/v5/otp/verify with authkey, mobile, otp
   ```
2. Create `lib/validators/phone.ts`:
   - `isValidIndianPhone(phone)` — validates +91 followed by 10 digits
   - `normalizePhone(phone)` — strips spaces/dashes, ensures +91 prefix
   - `isValidOTP(otp)` — 4-6 digit string
3. Create basic rate limiter `lib/rate-limit.ts`:
   - In-memory Map (sufficient for single-instance Sprint 1)
   - `checkRateLimit(key, maxAttempts, windowMs)` — returns `{ allowed, remainingAttempts, resetAt }`
   - Phone OTP limit: 3 sends per phone per 10 minutes
4. Create `/app/api/auth/phone/send-otp/route.ts`:
   - POST: receive `{ phone }` → validate format → check rate limit → call MSG91 sendOTP
   - Return `{ success: true }` or `{ error: 'Rate limit exceeded' / 'Invalid phone' }`
5. Create `/app/api/auth/phone/verify-otp/route.ts`:
   - POST: receive `{ phone, otp }` → validate format → call MSG91 verifyOTP
   - On success:
     - Upsert User in Prisma by phone number
     - Mint Firebase custom token: `adminAuth.createCustomToken(user.id)`
     - Return `{ customToken }` to client
   - On failure: return `{ error: 'Invalid OTP' }`
6. Update `/app/(auth)/login/page.tsx` — add phone OTP UI:
   - Tab or section: "Sign in with Phone"
   - Step 1: Phone number input (with +91 prefix, 10-digit field) + "Send OTP" button
   - Step 2 (shown after OTP sent): OTP input (4-6 digits) + "Verify" button + "Resend OTP" link
   - On successful verify: `signInWithCustomToken(auth, customToken)` → get ID token → POST to `/api/auth/session` → redirect to dashboard
   - Timer showing resend cooldown (30 seconds)
   - Loading states on both buttons

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `lib/msg91.ts` | MSG91 API wrapper |
| Create | `lib/validators/phone.ts` | Phone/OTP validation |
| Create | `lib/rate-limit.ts` | In-memory rate limiter |
| Create | `app/api/auth/phone/send-otp/route.ts` | Send OTP endpoint |
| Create | `app/api/auth/phone/verify-otp/route.ts` | Verify OTP + mint token endpoint |
| Modify | `app/(auth)/login/page.tsx` | Add phone OTP UI |

## 7. Testing / Verification

- [ ] Send OTP: enter valid Indian number → OTP received via SMS
- [ ] Verify OTP: enter correct OTP → signed in → redirected to dashboard
- [ ] User record created in Prisma with phone number (check Prisma Studio)
- [ ] Session cookie set (same as Google/GitHub flow)
- [ ] Invalid phone format → shows validation error before API call
- [ ] Wrong OTP → shows "Invalid OTP" error
- [ ] Rate limit: send OTP 3 times → 4th attempt blocked with "try again in X minutes"
- [ ] Resend OTP works after 30-second cooldown
- [ ] Firebase console shows user created with custom UID
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: Phone OTP flow (MSG91 → verify → custom token → Firebase session), rate limit rules
- Add to `CLAUDE.md`: "MSG91 is for DLT-compliant SMS only. Never use Firebase native Phone Auth for Indian numbers."
- Add to `docs/project-context.md`: Plan 05 completed, all 3 auth methods functional

## 9. Estimated Effort

- Claude Code execution: ~40 minutes
- Manual testing: ~15 minutes (test OTP flow, rate limits, error states)
- Documentation updates: ~5 minutes

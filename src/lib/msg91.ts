/**
 * MSG91 phone OTP — SERVER-SIDE ONLY.
 *
 * ⚠️  PLACEHOLDER. Every function here throws until the MSG91 integration
 *     sprint. Do not call from UI code yet.
 *
 * Why MSG91 and not Firebase Phone Auth: Indian carriers require DLT-registered
 * sender IDs and templates. MSG91 handles that compliance. Firebase Phone Auth
 * is retained only for its free verification quota.
 *
 * Flow once implemented:
 *   1. Client posts a phone number to an API route.
 *   2. Route calls `sendOTP` → MSG91 delivers the SMS.
 *   3. Client posts phone + code back.
 *   4. Route calls `verifyOTP`; on success it calls `createCustomToken`
 *      (`@/lib/firebase-admin`) and returns the token.
 *   5. Client calls `signInWithCustomToken` → Firebase session established.
 *
 * ⚠️  MSG91_AUTH_KEY is server-side only. Never prefix it with NEXT_PUBLIC_,
 *     never log it.
 */

const NOT_IMPLEMENTED = 'MSG91 integration is not implemented yet'

export interface SendOTPResult {
  /** MSG91 request identifier, echoed back on verification. */
  requestId: string
}

export interface VerifyOTPResult {
  verified: boolean
  /** E.164 phone number that was verified. */
  phone: string
}

/**
 * Sends a DLT-compliant OTP SMS to an Indian mobile number.
 *
 * @param phone E.164 format, e.g. "+919876543210".
 * @throws Always — not implemented.
 */
export async function sendOTP(phone: string): Promise<SendOTPResult> {
  void phone
  throw new Error(`${NOT_IMPLEMENTED}: sendOTP`)
}

/**
 * Verifies an OTP code previously sent by {@link sendOTP}.
 *
 * @param phone E.164 format, must match the number passed to `sendOTP`.
 * @param code The one-time code entered by the user.
 * @throws Always — not implemented.
 */
export async function verifyOTP(phone: string, code: string): Promise<VerifyOTPResult> {
  void phone
  void code
  throw new Error(`${NOT_IMPLEMENTED}: verifyOTP`)
}

/**
 * LOCAL DEVELOPMENT ONLY — sign in as an existing user without Firebase, so
 * screens can be reviewed (and screenshotted headless) on a laptop.
 *
 * Three independent locks, all required:
 *   1. NODE_ENV === 'development' — true only under `next dev`. Every
 *      production build (Vercel, `next build && next start`) sets
 *      NODE_ENV=production, so none of this can activate in production.
 *   2. The request host is localhost / 127.0.0.1.
 *   3. It impersonates an EXISTING user row only — it never creates users,
 *      orgs or sessions in Firebase.
 *
 * Edge-safe (no Node APIs) because the proxy imports it.
 */

export const DEV_USER_COOKIE = 'siq_dev_user'

export function devBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function isLocalHost(host: string | null | undefined): boolean {
  const h = (host ?? '').split(':')[0]!.toLowerCase()
  return h === 'localhost' || h === '127.0.0.1'
}

/**
 * Session constants shared by the proxy and the server-only session module.
 *
 * Kept in their own file with NO imports on purpose. `session.ts` is marked
 * `server-only` and pulls in the Firebase Admin SDK; importing it from
 * `src/proxy.ts` would drag that whole dependency into the proxy bundle, which
 * cannot run Node APIs. The proxy only needs the cookie name.
 */

/** Firebase convention. Also the only cookie name Firebase Hosting forwards. */
export const SESSION_COOKIE_NAME = '__session'

/** 5 days, per plan 004. Firebase allows 5 minutes to 2 weeks. */
export const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000

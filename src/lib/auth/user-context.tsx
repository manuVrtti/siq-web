'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { CurrentUser } from '@/types/auth'

/**
 * Plan 007 — current user for client components.
 *
 * A server component resolves the user (verified cookie → Postgres) and passes
 * it down. Client components read it from context instead of fetching, so the
 * role is available synchronously on first render with no loading flash.
 *
 * ⚠️  This value has crossed into the browser. Treat it as display data only.
 *     Anything it gates must be re-checked server-side — see RoleGate.
 */
const UserContext = createContext<CurrentUser | null | undefined>(undefined)

export function UserProvider({
  user,
  children,
}: {
  user: CurrentUser | null
  children: ReactNode
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

/**
 * The signed-in user, or null.
 *
 * @throws if used outside `UserProvider` — that is a wiring bug, and returning
 *   null instead would silently render the signed-out UI to a signed-in user.
 */
export function useCurrentUser(): CurrentUser | null {
  const value = useContext(UserContext)

  if (value === undefined) {
    throw new Error('useCurrentUser must be used within a UserProvider')
  }

  return value
}

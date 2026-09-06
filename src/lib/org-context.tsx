'use client'

import { createContext, useContext, type ReactNode } from 'react'

/**
 * Plan T02 — the active tenant for client components.
 *
 * Resolved server-side from the `[org]` URL segment (and access-enforced there),
 * then passed down. Client components read the active org's slug/name from here
 * to build tenant-prefixed links, rather than hardcoding or re-fetching.
 */
export type ActiveOrg = { id: string; slug: string; name: string }

const OrgContext = createContext<ActiveOrg | undefined>(undefined)

export function OrgProvider({ org, children }: { org: ActiveOrg; children: ReactNode }) {
  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>
}

/** The active org. Throws outside an OrgProvider — a wiring bug, not a state. */
export function useActiveOrg(): ActiveOrg {
  const value = useContext(OrgContext)
  if (!value) throw new Error('useActiveOrg must be used within an OrgProvider')
  return value
}

/** Convenience: prefix a path with the active org, e.g. orgHref('/questions'). */
export function useOrgHref(): (path: string) => string {
  const org = useActiveOrg()
  return (path: string) => `/${org.slug}${path.startsWith('/') ? path : `/${path}`}`
}

# Plan T01 — Multi-Tenant Foundation (tenant context + provisioning)

> **Status:** In progress
> **Inserted into Sprint 2 before Plan 012.** Not part of the original 51-plan
> set — added after SG's decision to build a product that scales cleanly from
> 1 college to 100. Supersedes the interim `getActiveOrg` (first-membership)
> resolution introduced in Plan 011.

---

## 1. Objective

Give SelectIQ a real, scalable tenant model so every org-scoped feature after
this (assessments, candidates, results) is built on solid ground rather than
the "first membership" placeholder.

## 2. What is already scalable (no change needed)

The data layer is already correct shared-database multi-tenancy: every table
carries `orgId`, and every query is scoped and access-checked via
`requireOrgAccess` (Plans 003/007/011). 1 tenant or 100 is the same
architecture — only rows differ. This plan does NOT change that.

## 3. What this plan adds

1. **Path-based tenant routing** — `selectsiq.in/{orgSlug}/...`. The active org
   is resolved from the URL segment and access-enforced, not guessed from the
   user's first membership.
2. **Org provisioning** — a real way to create a college and assign its admin,
   replacing ad-hoc creation in scripts.
3. **Post-login routing** — send a user to their org; handle zero / one / many
   memberships.

## 4. Why path-based (and the subdomain path)

Path-based needs no wildcard DNS/SSL, no Firebase authorized-domain workaround,
and works for colleges on shared email domains. Crucially it is
forward-compatible: a subdomain (`abes.selectsiq.in`) can later be rewritten to
`/abes/...` at the edge, mapping the subdomain to the same slug — so subdomains
become a pure presentation layer added with zero change to routing, auth, or
the data model.

## 5. Implementation increments

**Increment 1 — provisioning (this PR)**
- `Organization.slug` becomes required + format-validated (safe: 0 orgs exist).
- `src/services/organizations.ts` — `createOrganization`, `addMember`,
  slug validation/uniqueness. Creating an org adds the creator (or a named
  admin) as an `ADMIN` member atomically.
- `/api/orgs` — POST (SUPER_ADMIN) create org; `/api/orgs/[slug]/members` add
  a member by email.
- A super-admin "create organization" page.

**Increment 2 — tenant routing (next PR)**
- Move `(protected)/*` feature pages under `(protected)/[org]/`.
- `[org]/layout.tsx` resolves the org by slug, enforces membership (or
  SUPER_ADMIN), provides it via `OrgProvider`; the app shell nav becomes
  org-prefixed.
- Post-login redirect to `/{org}/dashboard`; org picker when a user has several;
  onboarding state when none.
- Retire `getActiveOrg`.

## 6. Security

Tenant resolution never trusts the client: the slug from the URL is looked up,
and `requireOrgAccess(user, org.id)` must pass (membership, or SUPER_ADMIN
bypass) before anything renders or returns. A guessed slug for an org the user
does not belong to yields 404/redirect, never data.

## 7. Verification

- Create an org via the API as SUPER_ADMIN; non-super roles are 403.
- Slug uniqueness + format enforced.
- A member of org A visiting `/{orgB}/...` is refused.
- Post-login lands the user in their org.
- `npm run build` passes.

## 8. Deferred

- Subdomain presentation layer (later; this makes it a rewrite away).
- Full org settings / branding / bulk onboarding (Plan 046, Plan 013 roster).
- Org switcher polish for multi-org users (basic picker only here).

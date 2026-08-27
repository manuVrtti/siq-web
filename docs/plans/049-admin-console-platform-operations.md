# Plan 049 — Admin Console & Platform Operations

## 1. Objective

Build the SuperAdmin console that centralizes platform operations: managing organizations and users, feature flags, system configuration, support tooling, and operational health — everything needed to run SelectIQ as a business.

## 2. Scope

- Unified SuperAdmin console (consolidating scattered admin pages)
- Organization management (view, suspend, impersonate for support)
- User management (search, roles, account actions)
- Feature flags (gradual rollout, per-org toggles)
- System configuration (platform-wide settings)
- Support tooling (impersonation, account recovery assist)
- Operational dashboard (health, jobs, errors)

### Out of Scope

- Full observability/monitoring stack (Plan 41, Sprint 5)
- Customer support ticketing (external tool)
- Advanced analytics (already in Plans 19, 30)

## 3. Prerequisites / Dependencies

- Plans 31–37 (the services this console operates)
- Plan 07 (SUPER_ADMIN role)
- Plan 37 (audit — impersonation and admin actions must be logged)

## 4. Technical Approach

Several admin pages already exist piecemeal (company verification P21, subscriptions P36, jobs P34, audit P37). This plan unifies them into a coherent SuperAdmin console with consistent navigation, and adds the missing operational primitives: org lifecycle management, user management, feature flags, and support impersonation.

**Impersonation** is powerful and sensitive: SuperAdmin can view the platform as a specific user for support/debugging, with every impersonated action heavily audited (Plan 37) and clearly indicated in the UI. Feature flags enable safe rollout of new capabilities.

## 5. Implementation Steps

1. Add Prisma models:
   ```prisma
   model FeatureFlag {
     id            String    @id @default(cuid())
     key           String    @unique
     name          String
     description   String?
     enabled       Boolean   @default(false)
     rolloutPercent Int      @default(0)   // gradual rollout
     enabledOrgIds String[]                // per-org overrides
     updatedAt     DateTime  @updatedAt
   }

   model PlatformConfig {
     id            String    @id @default(cuid())
     key           String    @unique
     value         Json
     updatedById   String
     updatedAt     DateTime  @updatedAt
   }

   model ImpersonationSession {
     id            String    @id @default(cuid())
     adminId       String
     targetUserId  String
     reason        String
     startedAt     DateTime  @default(now())
     endedAt       DateTime?

     @@index([adminId])
     @@index([targetUserId])
   }
   ```
2. Run migration: `npx prisma migrate dev --name admin_console`
3. Create `lib/feature-flags.ts`:
   - `isEnabled(key, ctx?)` — checks global + rollout % + per-org override
   - `useFeatureFlag(key)` — client hook
   - Cache flags (short TTL) to avoid per-check DB hits
4. Create `services/admin/organizations.ts`:
   - `listOrganizations(filters)` — all orgs, type, status, subscription
   - `getOrgDetail(orgId)` — full profile, members, usage, subscription
   - `suspendOrg(orgId, reason)` / `reactivateOrg(orgId)`
   - `deleteOrg(orgId)` — soft delete with safeguards
5. Create `services/admin/users.ts`:
   - `searchUsers(query)` — platform-wide (with audit)
   - `getUserDetail(userId)` — memberships, activity
   - `updateUserRole(userId, role)` / `suspendUser` / `unlockUser`
   - `resetUserAuth(userId)` — support account recovery
6. Create `services/admin/impersonation.ts`:
   - `startImpersonation(adminId, targetUserId, reason)` — creates session, issues scoped token, audits CRITICAL
   - `endImpersonation(sessionId)`
   - Impersonation token clearly distinct; actions audited as "impersonated"
7. Create `services/admin/platform-config.ts`:
   - `getConfig(key)` / `setConfig(key, value)` — platform-wide settings (maintenance mode, signup toggle, default limits)
8. Create feature flag management:
   - `services/admin/feature-flags.ts` — CRUD + rollout control
9. Create API routes (all SUPER_ADMIN, all audited):
   - `/app/api/admin/organizations/route.ts`, `[orgId]/route.ts`, `[orgId]/suspend/route.ts`
   - `/app/api/admin/users/route.ts`, `[userId]/route.ts`, `[userId]/reset-auth/route.ts`
   - `/app/api/admin/impersonate/route.ts` — POST (start), DELETE (end)
   - `/app/api/admin/feature-flags/route.ts`, `[key]/route.ts`
   - `/app/api/admin/config/route.ts`
10. Build unified console:
    - `/app/(protected)/admin/page.tsx` — operational dashboard (orgs, users, MRR, active jobs, error rate, recent critical audits)
    - `/app/(protected)/admin/organizations/page.tsx` + `[orgId]/page.tsx` — org management
    - `/app/(protected)/admin/users/page.tsx` + `[userId]/page.tsx` — user management
    - `/app/(protected)/admin/feature-flags/page.tsx` — flag management
    - `/app/(protected)/admin/config/page.tsx` — platform config
    - Consolidate existing admin pages (companies P21, subscriptions P36, jobs P34, audit P37, analytics P19/30) under a unified admin nav
11. Implement impersonation UX:
    - "View as user" action → impersonation banner (persistent, "Exit impersonation")
    - `components/admin/impersonation-banner.tsx`
    - Middleware/session aware of impersonation token
12. Add maintenance mode:
    - `PlatformConfig` maintenance flag → middleware shows maintenance page (except SuperAdmin)
13. Create components:
    - `components/admin/admin-shell.tsx` (admin console nav)
    - `components/admin/org-management-table.tsx`
    - `components/admin/user-management-table.tsx`
    - `components/admin/feature-flag-editor.tsx`
    - `components/admin/ops-dashboard.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | FeatureFlag, PlatformConfig, ImpersonationSession |
| Create | `lib/feature-flags.ts` | Flag evaluation |
| Create | `services/admin/*.ts` | Admin operations |
| Create | `app/api/admin/*/route.ts` | Admin APIs |
| Create | `app/(protected)/admin/*` | Console pages |
| Modify | `middleware.ts` | Impersonation + maintenance mode |
| Create | `components/admin/*.tsx` | Admin UI |
| Modify | Existing admin pages | Consolidate under console |

## 7. Testing / Verification

- [ ] Ops dashboard shows accurate platform metrics
- [ ] Search + view any organization
- [ ] Suspend org → members lose access, reactivate restores
- [ ] Search + view any user
- [ ] Update user role → takes effect
- [ ] Reset user auth (support) → user can re-authenticate
- [ ] Start impersonation → view as user, banner shown, actions audited as impersonated
- [ ] Exit impersonation → return to admin
- [ ] Feature flag off → feature hidden; on → visible
- [ ] Rollout % → gradual enablement works
- [ ] Per-org flag override works
- [ ] Maintenance mode → non-admins see maintenance page, admin unaffected
- [ ] All admin actions audited (Plan 37)
- [ ] Non-SuperAdmin blocked from all admin routes (403)
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: admin console structure, feature flag evaluation, impersonation (heavily audited), maintenance mode
- Add to `CLAUDE.md`: "Impersonation actions are CRITICAL-audited and visibly flagged; never silent"
- Add to `docs/project-context.md`: Plan 38 completed, admin console live — Sprint 4 complete, platform operable as a business

## 9. Estimated Effort

- Claude Code execution: ~70 minutes
- Manual testing: ~30 minutes (impersonation, flags, org/user management)
- Documentation updates: ~5 minutes

# Plan 046 — Organization Settings & Multi-User Onboarding

## 1. Objective

Build comprehensive organization settings and team onboarding, letting college and company admins configure their org, invite and manage team members with granular roles, and customize their workspace.

## 2. Scope

- Organization settings (profile, branding, preferences)
- Team member invitation and management
- Granular sub-roles within an org (beyond the 4 platform roles)
- Member permissions and access scoping
- Organization-level configuration (assessment defaults, drive settings)
- Onboarding checklist for new orgs

### Out of Scope

- Billing/subscription (Plan 36)
- SSO/SAML for enterprise (Sprint 6)
- Cross-org member transfer

## 3. Prerequisites / Dependencies

- Plan 07 (RBAC — this extends org-scoping with sub-roles)
- Plan 31 (notifications for invitations)
- Plan 09 (storage for branding assets)

## 4. Technical Approach

The platform has 4 top-level roles (Plan 07). This plan adds org-internal granularity: within a college, there might be a Placement Head, Coordinators, and Faculty; within a company, a Hiring Manager, Recruiters, and Interviewers. These are `OrgRole`s layered on the `OrganizationMember` model.

Invitations create pending memberships; invitees accept via a link (existing Firebase auth). Org settings cover branding (used in exports/offer letters/reports), defaults (assessment/drive presets), and preferences.

An onboarding checklist guides new orgs through setup (profile, team, first assessment/job) to reduce time-to-value.

## 5. Implementation Steps

1. Extend Prisma models:
   ```prisma
   enum OrgRole {
     OWNER
     ADMIN
     MANAGER
     MEMBER
     VIEWER
   }

   enum InviteStatus {
     PENDING
     ACCEPTED
     EXPIRED
     REVOKED
   }

   // Extend OrganizationMember (Plan 03) with granular role:
   // add: orgRole OrgRole @default(MEMBER)
   //      title String?   (e.g. "Placement Coordinator")

   model OrgInvitation {
     id            String       @id @default(cuid())
     orgId         String
     email         String
     orgRole       OrgRole      @default(MEMBER)
     token         String       @unique @default(cuid())
     status        InviteStatus @default(PENDING)
     invitedById   String
     expiresAt     DateTime
     createdAt     DateTime     @default(now())
     acceptedAt    DateTime?

     org           Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)

     @@index([orgId])
     @@index([token])
   }

   model OrgSettings {
     id                String    @id @default(cuid())
     orgId             String    @unique
     primaryColor      String?
     bannerUrl         String?
     letterheadUrl     String?
     defaultAssessmentDuration Int?
     proctoringDefault Boolean   @default(false)
     preferences       Json?     // extensible key-value
     onboardingComplete Boolean  @default(false)
     onboardingSteps   Json?     // checklist state

     org               Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
   }
   ```
2. Run migration: `npx prisma migrate dev --name org_settings_onboarding`
3. Create `services/org-settings.ts`:
   - `getSettings(orgId)` / `updateSettings(orgId, data)`
   - `getOnboardingState(orgId)` — computes checklist completion
   - `uploadBranding(orgId, type, file)` — banner, letterhead
4. Create `services/org-members.ts`:
   - `listMembers(orgId)` — with orgRole, title
   - `updateMemberRole(orgId, userId, orgRole)` — OWNER/ADMIN only
   - `removeMember(orgId, userId)`
   - `inviteMember(orgId, email, orgRole)` — creates OrgInvitation, notifies
   - `acceptInvitation(token, userId)` — creates membership
   - `revokeInvitation(id)` / `resendInvitation(id)`
5. Create `lib/auth/org-roles.ts`:
   - `hasOrgRole(member, minRole)` — hierarchy check (OWNER > ADMIN > MANAGER > MEMBER > VIEWER)
   - `requireOrgRole(user, orgId, minRole)` — enforcement
   - Integrate with existing permission checks (Plan 07)
6. Create API routes:
   - `/app/api/org/settings/route.ts` — GET, PATCH
   - `/app/api/org/branding/route.ts` — POST
   - `/app/api/org/members/route.ts` — GET
   - `/app/api/org/members/[userId]/route.ts` — PATCH (role), DELETE
   - `/app/api/org/invitations/route.ts` — GET, POST
   - `/app/api/org/invitations/[id]/route.ts` — DELETE (revoke)
   - `/app/api/invitations/accept/route.ts` — POST (token)
   - `/app/api/org/onboarding/route.ts` — GET
7. Create org admin pages:
   - `/app/(protected)/settings/organization/page.tsx` — org profile + branding + defaults
   - `/app/(protected)/settings/team/page.tsx` — member list, invite, role management
   - `/app/(protected)/settings/team/invite/page.tsx` — invite flow
8. Create invitation acceptance:
   - `/app/(auth)/accept-invite/[token]/page.tsx` — accept org invitation (sign in/up → join org)
9. Create onboarding UI:
   - `components/onboarding/onboarding-checklist.tsx` — dashboard widget for new orgs
   - Steps: complete profile → add branding → invite team → create first assessment/job → publish first
10. Apply branding across outputs:
    - Offer letters (Plan 27), placement reports (Plan 30), exports (Plan 20) use org branding
11. Create components:
    - `components/org/settings-form.tsx`
    - `components/org/member-table.tsx`
    - `components/org/invite-form.tsx`
    - `components/org/branding-uploader.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | OrgRole, OrgInvitation, OrgSettings |
| Create | `services/org-settings.ts` | Settings logic |
| Create | `services/org-members.ts` | Member + invitation logic |
| Create | `lib/auth/org-roles.ts` | Org role hierarchy |
| Create | `app/api/org/*/route.ts` | Org APIs |
| Create | `app/api/invitations/accept/route.ts` | Accept invite |
| Create | `app/(protected)/settings/organization/page.tsx` | Org settings |
| Create | `app/(protected)/settings/team/*` | Team management |
| Create | `app/(auth)/accept-invite/[token]/page.tsx` | Invite acceptance |
| Create | `components/onboarding/onboarding-checklist.tsx` | Onboarding |
| Create | `components/org/*.tsx` | Org components |
| Modify | Offer/report/export services | Apply branding |

## 7. Testing / Verification

- [ ] Admin updates org profile + branding → saved, reflected in exports
- [ ] Invite team member by email → OrgInvitation created, email sent
- [ ] Invitee accepts via link → becomes org member with assigned role
- [ ] Assign MANAGER role → member gets manager-level access
- [ ] VIEWER role → read-only, cannot edit
- [ ] Remove member → access revoked
- [ ] Revoke pending invitation → link no longer works
- [ ] Resend invitation → new email sent
- [ ] Org role hierarchy enforced (MEMBER can't manage team)
- [ ] Onboarding checklist reflects completion accurately
- [ ] Offer letter uses org letterhead
- [ ] Placement report uses org branding
- [ ] Cross-org: admin can't manage another org's team
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: org-role hierarchy (layered on platform roles), invitation flow, settings + branding propagation
- Add to `docs/project-context.md`: Plan 35 completed, org settings + team onboarding live

## 9. Estimated Effort

- Claude Code execution: ~65 minutes
- Manual testing: ~25 minutes (roles, invitations, branding)
- Documentation updates: ~5 minutes

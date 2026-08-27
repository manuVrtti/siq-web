# Plan 007 — Role-Based Access Control (RBAC)

## 1. Objective

Implement a multi-role permission system supporting SuperAdmin, CollegeAdmin, Recruiter, and Student roles with organization-scoped access control.

## 2. Scope

- Permission constants and role-to-permission mapping
- Permission check helpers (hasPermission, requirePermission, requireRole)
- Organization membership verification (cross-org access prevention)
- Client-side RoleGate component for conditional rendering
- API route role enforcement

### Out of Scope

- Dynamic permission management UI (admin can't edit role-permission mappings yet)
- Invitation/onboarding flow for organization members
- Role assignment UI (done manually via Prisma Studio for Sprint 1)
- Fine-grained resource-level permissions (e.g., per-assessment access)

## 3. Prerequisites / Dependencies

- Plan 06 completed (`getCurrentUser()` available)
- Plan 03 completed (User, Organization, OrganizationMember models)

## 4. Technical Approach

Static role-permission mapping (hardcoded, not database-driven). This is simpler, faster, and appropriate until the permission model stabilizes. Roles are hierarchical in power but not inherited — each role has an explicit list of permissions.

Two layers of access control:
1. **Role-based**: "Can this role perform this action?" (e.g., only COLLEGE_ADMIN can create assessments)
2. **Organization-scoped**: "Does this user belong to the org they're trying to access?" (prevents cross-org data leaks)

## 5. Implementation Steps

1. Create `constants/permissions.ts`:
   ```typescript
   export const PERMISSIONS = {
     // User management
     MANAGE_ALL_USERS: 'manage_all_users',       // SuperAdmin only
     MANAGE_ORG_USERS: 'manage_org_users',        // CollegeAdmin, Recruiter
     
     // Organization
     MANAGE_ALL_ORGS: 'manage_all_orgs',          // SuperAdmin only
     MANAGE_OWN_ORG: 'manage_own_org',            // CollegeAdmin
     VIEW_OWN_ORG: 'view_own_org',                // All org members
     
     // Assessments
     CREATE_ASSESSMENT: 'create_assessment',       // CollegeAdmin, Recruiter
     EDIT_ASSESSMENT: 'edit_assessment',            // CollegeAdmin, Recruiter
     VIEW_ASSESSMENT: 'view_assessment',            // All
     TAKE_ASSESSMENT: 'take_assessment',            // Student
     
     // Results
     VIEW_ALL_RESULTS: 'view_all_results',          // SuperAdmin
     VIEW_ORG_RESULTS: 'view_org_results',          // CollegeAdmin, Recruiter
     VIEW_OWN_RESULTS: 'view_own_results',          // Student
     
     // Platform
     VIEW_PLATFORM_ANALYTICS: 'view_platform_analytics',  // SuperAdmin
     MANAGE_PLATFORM_SETTINGS: 'manage_platform_settings', // SuperAdmin
   } as const;

   export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];
   ```
2. Create `lib/auth/role-permissions.ts`:
   ```typescript
   export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
     SUPER_ADMIN: [/* all permissions */],
     COLLEGE_ADMIN: [MANAGE_ORG_USERS, MANAGE_OWN_ORG, CREATE_ASSESSMENT, ...],
     RECRUITER: [MANAGE_ORG_USERS, CREATE_ASSESSMENT, VIEW_ORG_RESULTS, ...],
     STUDENT: [VIEW_ASSESSMENT, TAKE_ASSESSMENT, VIEW_OWN_RESULTS, VIEW_OWN_ORG],
   };
   ```
3. Create `lib/auth/permissions.ts`:
   ```typescript
   export function hasPermission(user: CurrentUser, permission: Permission): boolean
   export function requirePermission(user: CurrentUser, permission: Permission): void // throws ForbiddenError
   ```
4. Create `lib/auth/require-role.ts`:
   ```typescript
   export function requireRole(user: CurrentUser, roles: UserRole[]): void // throws ForbiddenError
   
   // Convenience for API routes:
   export async function withRole(roles: UserRole[]): Promise<CurrentUser> {
     const user = await requireAuth();
     requireRole(user, roles);
     return user;
   }
   ```
5. Create `lib/auth/org-access.ts`:
   ```typescript
   export async function belongsToOrg(userId: string, orgId: string): Promise<boolean>
   // Checks OrganizationMember table
   
   export async function requireOrgAccess(userId: string, orgId: string): Promise<void>
   // Throws ForbiddenError if not a member
   
   export async function getUserOrgs(userId: string): Promise<Organization[]>
   // Returns all orgs the user belongs to
   ```
6. Create `components/auth/RoleGate.tsx`:
   ```typescript
   // Client component
   interface RoleGateProps {
     allowedRoles: UserRole[];
     children: React.ReactNode;
     fallback?: React.ReactNode;  // Optional "access denied" UI
   }
   // Reads user role from a React context (set up in protected layout)
   // Renders children if role matches, fallback otherwise
   ```
7. Create `lib/auth/user-context.tsx`:
   - `UserProvider` context — wraps protected layout
   - `useCurrentUser()` hook — reads current user from context
   - Server component fetches user, passes to client provider
8. Create `lib/errors.ts` (if not already):
   - `AuthError` (401)
   - `ForbiddenError` (403)
   - `ValidationError` (400)
   - `NotFoundError` (404)
9. Add example usage in a test API route:
   ```typescript
   // Only CollegeAdmin and SuperAdmin can access
   export async function GET() {
     const user = await withRole(['COLLEGE_ADMIN', 'SUPER_ADMIN']);
     // ... handler logic
   }
   ```

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Create | `constants/permissions.ts` | Permission constants |
| Create | `lib/auth/role-permissions.ts` | Role-to-permission mapping |
| Create | `lib/auth/permissions.ts` | Permission check helpers |
| Create | `lib/auth/require-role.ts` | Role enforcement |
| Create | `lib/auth/org-access.ts` | Organization scope checks |
| Create | `components/auth/RoleGate.tsx` | Client-side role gate |
| Create | `lib/auth/user-context.tsx` | User context provider + hook |
| Create | `lib/errors.ts` | Custom error classes |

## 7. Testing / Verification

- [ ] Student user cannot access admin API routes (403 returned)
- [ ] CollegeAdmin can access org management routes
- [ ] SuperAdmin can access all routes
- [ ] `RoleGate` hides admin nav items from Student users
- [ ] `RoleGate` shows admin nav items to CollegeAdmin users
- [ ] Cross-org access denied: CollegeAdmin from Org A cannot access Org B data
- [ ] `useCurrentUser()` hook returns correct user in client components
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: RBAC pattern, permission constants, `withRole()` usage in API routes, `RoleGate` usage in components
- Add to `CLAUDE.md`: "Always use `requireOrgAccess()` when accessing org-scoped data — never trust orgId from client without verification"
- Add to `docs/project-context.md`: Plan 07 completed, 4-role RBAC active

## 9. Estimated Effort

- Claude Code execution: ~35 minutes
- Manual testing: ~15 minutes (test each role, cross-org)
- Documentation updates: ~5 minutes

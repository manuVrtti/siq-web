# Plan 022 — HOD Role & Department Model

## 1. Objective

Introduce the HOD (Head of Department) role and the department model, with department-scoped access control — the missing role that unblocks the HOD dashboard and department-level analytics. Also formalizes the Placement Head role for college-wide scope.

## 2. Scope

- New roles: HOD (department-scoped), PLACEMENT_HEAD (college-scoped)
- Department model within a college org
- Student-to-department assignment
- Department-scoped RBAC (HOD sees only their department)
- Faculty/HOD assignment to departments
- Role management UI for college admins

### Out of Scope

- The dashboards themselves (Plans 26–28)
- Competency data (Plans 25a/25b)
- Cross-college roles (platform-level stays SuperAdmin)

## 3. Prerequisites / Dependencies

- Sprint 1 complete (RBAC from Plan 07)
- Plan 22-Sprint2 / StudentProfile concept (extended here)

## 4. Technical Approach

The existing RBAC (Plan 07: SUPER_ADMIN, COLLEGE_ADMIN, RECRUITER, STUDENT) lacks the academic hierarchy Indian colleges run on. We add:

- **PLACEMENT_HEAD** — college-wide placement/analytics authority (the placement cell head). Scoped to the whole college org.
- **HOD** — department-scoped. Sees and manages only their department's students and analytics.

A `Department` belongs to a college org (e.g., "Computer Science", "Electronics"). Students belong to a department. HODs are assigned to departments. This creates a clean scoping rule: **HOD queries are always filtered to `department IN (their assigned departments)`**, whereas PLACEMENT_HEAD and COLLEGE_ADMIN see all departments.

This scoping is the access-control spine for Plan 27 (HOD dashboard) — get it right here and the dashboard is just a view.

## 5. Implementation Steps

1. Extend the role enum in Prisma:
   ```prisma
   enum UserRole {
     SUPER_ADMIN
     COLLEGE_ADMIN
     PLACEMENT_HEAD   // new — college-wide placement authority
     HOD              // new — department-scoped
     RECRUITER
     STUDENT
   }
   ```
2. Add Department models:
   ```prisma
   model Department {
     id            String    @id @default(cuid())
     collegeOrgId  String
     name          String
     code          String    // e.g. "CSE", "ECE"
     createdAt     DateTime  @default(now())

     college       Organization @relation(fields: [collegeOrgId], references: [id], onDelete: Cascade)
     hods          DepartmentHOD[]
     students      StudentProfile[]

     @@unique([collegeOrgId, code])
     @@index([collegeOrgId])
   }

   model DepartmentHOD {
     departmentId  String
     userId        String
     assignedAt    DateTime @default(now())

     department    Department @relation(fields: [departmentId], references: [id], onDelete: Cascade)
     user          User       @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@id([departmentId, userId])
     @@index([userId])
   }
   ```
3. Extend StudentProfile with department link:
   ```prisma
   // Add to StudentProfile:
   departmentId  String?
   department    Department? @relation(fields: [departmentId], references: [id])
   ```
4. Run migration: `npx prisma migrate dev --name hod_department_model`
5. Extend `constants/permissions.ts` (Plan 07):
   - PLACEMENT_HEAD: college-wide analytics, drive management, placement reporting
   - HOD: department-scoped analytics, view department students, department reports
6. Update `lib/auth/role-permissions.ts` with new role mappings
7. Create `lib/auth/department-scope.ts` — the scoping spine:
   - `getHODDepartments(userId)` — departments this HOD manages
   - `getScopedDepartmentIds(user)` — returns:
     - HOD → their assigned departments
     - PLACEMENT_HEAD / COLLEGE_ADMIN → all departments in their college
     - throws for others
   - `requireDepartmentAccess(user, departmentId)` — enforce HOD boundary
   - `scopeStudentsQuery(user)` — returns Prisma `where` clause for department-scoped student queries (reused everywhere)
8. Create `services/departments.ts`:
   - `createDepartment` / `updateDepartment` / `listDepartments(collegeOrgId)`
   - `assignHOD(departmentId, userId)` / `removeHOD`
   - `assignStudentToDepartment(userId, departmentId)`
   - `bulkAssignStudents(assignments[])`
   - `getDepartmentRoster(departmentId)` — students in department
9. Create API routes:
   - `/app/api/departments/route.ts` — GET, POST
   - `/app/api/departments/[id]/route.ts` — PATCH, DELETE
   - `/app/api/departments/[id]/hods/route.ts` — POST, DELETE
   - `/app/api/departments/[id]/students/route.ts` — GET, POST (assign)
10. Create college-admin UI:
    - `/app/(protected)/college/departments/page.tsx` — CRUD departments, assign HODs
    - `/app/(protected)/college/roles/page.tsx` — assign PLACEMENT_HEAD / HOD roles to users
    - Student department assignment (individual + bulk via import pattern from Sprint 2 Plan 20)
11. Update navigation (Plan 08): role-aware items for HOD + PLACEMENT_HEAD
12. Update RoleGate usage and dashboard routing (Plan 29-Sprint2 / Plan 26 here) to recognize new roles
13. Create components:
    - `components/departments/department-manager.tsx`
    - `components/departments/hod-assignment.tsx`
    - `components/departments/student-department-assigner.tsx`

## 6. File Changes

| Action | File | Description |
|--------|------|-------------|
| Modify | `prisma/schema.prisma` | UserRole enum, Department, DepartmentHOD, StudentProfile.departmentId |
| Modify | `constants/permissions.ts` | HOD + PLACEMENT_HEAD permissions |
| Modify | `lib/auth/role-permissions.ts` | New role mappings |
| Create | `lib/auth/department-scope.ts` | Department scoping spine |
| Create | `services/departments.ts` | Department logic |
| Create | `app/api/departments/*/route.ts` | Department APIs |
| Create | `app/(protected)/college/departments/page.tsx` | Department management |
| Create | `app/(protected)/college/roles/page.tsx` | Role assignment |
| Modify | `constants/navigation.ts` | HOD/Placement Head nav |
| Create | `components/departments/*.tsx` | UI |

## 7. Testing / Verification

- [ ] Create departments (CSE, ECE, MECH) under college
- [ ] Assign user as HOD of CSE → role HOD, linked to CSE
- [ ] Assign user as PLACEMENT_HEAD → college-wide scope
- [ ] Assign students to departments (individual + bulk)
- [ ] `getScopedDepartmentIds`: HOD → only CSE; Placement Head → all
- [ ] HOD querying ECE students → blocked (department boundary)
- [ ] HOD querying own CSE students → allowed
- [ ] Placement Head sees all departments
- [ ] `scopeStudentsQuery` produces correct where-clause per role
- [ ] HOD nav shows department views; Placement Head shows college views
- [ ] Student can be reassigned between departments
- [ ] Cross-college: HOD can't see another college's departments
- [ ] `npm run build` passes

## 8. Documentation Updates

- Add to `CLAUDE.md`: HOD + PLACEMENT_HEAD roles, Department model, `department-scope.ts` spine, `scopeStudentsQuery` pattern
- Add to `CLAUDE.md`: "HOD-scoped queries MUST use `scopeStudentsQuery(user)` — never trust a departmentId from the client"
- Add to `docs/project-context.md`: Phase 1 Plan 22 completed, HOD role + departments live

## 9. Estimated Effort

- Claude Code execution: ~55 minutes
- Manual testing: ~20 minutes (role scoping is critical — test boundaries thoroughly)
- Documentation updates: ~5 minutes

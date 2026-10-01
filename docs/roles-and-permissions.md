# SelectIQ — Roles & Permissions (Source of Truth)

> **Last updated:** 2026-10-02
> **Owner:** SG (founder). Change this document, `src/services/people.ts`, `src/lib/auth/scope.ts` and
> `src/components/people/access-matrix.tsx` **together** — they must never disagree.

SelectIQ is a real product holding real students' data for real colleges. Access control is the part
of the system where a mistake costs the most. Every rule below is enforced on the **server**. Hiding a
button is never the control.

---

## 1. The five roles

| Role | Runs | Boundary |
|---|---|---|
| **Super Admin** | The platform | Everything: every college and company, every person |
| **College Admin** | One college | Everything inside the college(s) they belong to |
| **College HOD** | One or more departments | Students, tests and results of the departments they head |
| **Recruiter** | A hiring company | Their company's workspace (Phase 2 marketplace) |
| **Student** | Themselves | Their own exams, results, profile and analytics |

A person has exactly **one** role (`User.role`). Which college they belong to is a separate fact
(`OrganizationMember`). Which departments an HOD heads is a third (`DepartmentHead`). A student's
department lives on their college membership (`OrganizationMember.departmentId`).

## 2. Who can manage whom

```
Super Admin
  └─ manages ALL: colleges & companies, College Admins, HODs, students, recruiters, other Super Admins
       │
       College Admin  (inside their own college only)
         └─ manages: other College Admins, HODs (and which departments they head),
            departments, students, tests, results, college settings
              │
              HOD  (inside the departments they head only)
                └─ manages: their students, batches, tests, grading, results, analytics
```

| Action | Super Admin | College Admin | HOD |
|---|:-:|:-:|:-:|
| Create colleges & companies | ✅ | — | — |
| Edit college name / email domain / URL | ✅ | — (read-only, contact SelectIQ) | — |
| Add / remove College Admins | ✅ | own college | — |
| Add / remove HODs, set their departments | ✅ | own college | — |
| Create, rename, delete departments | ✅ | own college | — |
| Choose "students pick department" vs "college assigns" | ✅ | own college | — |
| Import, edit, move, remove students; password sign-in | ✅ | own college | own departments |
| Build, publish, assign tests | ✅ | own college | own departments' tests |
| Results, grading, proctoring review, analytics, exports | ✅ | own college | own students only |
| Question bank | ✅ | shared college-wide | shared college-wide |
| Suspend / reactivate accounts | ✅ | — | — |
| Suspend / reactivate a whole college (contract, payment…) | ✅ | — | — |
| Onboard colleges, export directories, global search | ✅ | — | — |
| Grant Super Admin | ✅ | — | — |

## 3. Guards that apply to everyone (Super Admins included)

1. **Nobody changes their own role, removes themselves, or suspends themselves.** No self-lockout.
2. **A college always keeps at least one College Admin.** Demoting or removing the last one is refused.
3. **The platform always keeps at least one active Super Admin.**
4. **A role is global.** A College Admin cannot change an account that also belongs to another
   organization; only a Super Admin can.
5. **Super Admin and recruiter accounts can't be added as college staff.**
6. **Default deny.** An HOD heading no department sees nothing. A student with no department is
   visible only to College Admins.
7. **Suspension is immediate.** It blocks sign-in, rejects every request even on a live session,
   disables the Firebase account and revokes its tokens. Nothing is deleted; it can be reversed.
8. **A suspended college is paused for every member** — APIs (`requireOrgAccess`, `services/people.ts`),
   the workspace (paused page), exam start (`ORG_PAUSED`), reports and résumé access. Super Admins
   keep access to fix things. Nothing is deleted; reactivating restores everything.
9. **Every change is audited** (`AuditLog`): role changes, staff changes, suspensions, Super Admin
   grants, department and HOD changes. Audit metadata never holds secrets, passwords or answer content.
10. **No env-based admin grants.** Super Admin is only ever granted by an existing Super Admin, in
   the console, and audited. (Lesson from ABtalks plan 169: a grant made from the environment comes
   back after it was revoked.)

## 4. Where it lives in code

| Concern | File |
|---|---|
| Role → permissions (what kind of user may act) | `src/lib/auth/role-permissions.ts` |
| Department scope for every manager query (HOD vs college-wide) | `src/lib/auth/scope.ts` |
| Who may manage whom, plus all the guards above | `src/services/people.ts` |
| Departments & HOD assignment | `src/services/departments.ts` |
| Suspension enforcement | `src/lib/auth/get-current-user.ts`, `src/app/api/auth/session/route.ts` |
| "Who can do what" shown in the product | `src/components/people/access-matrix.tsx` |

## 5. The panels

| Panel | Who | Where |
|---|---|---|
| **Platform console** | Super Admin | `/admin`: Overview (KPIs, needs attention, most active, recently onboarded), Search, Colleges & companies directory (search, filters incl. state & health, sort, export) with an Onboard wizard and per-college Overview · People · Departments · Students · Settings (suspend/reactivate), All people (filters, export, role, suspend, detail), Platform admins, Audit log (filter by college) |
| **College admin** | College Admin (and Super Admin) | `/[college]/manage`: Overview (health + needs attention), People (College Admins + HODs), Departments, Settings |
| **My department** | HOD | `/[college]/department`: each department's students, tests, scores, pass rate, shortcuts |

All three use the same guarded services and APIs. The Super Admin's college page reuses the
College Admin's components, so the two can't drift apart.

## 6. Shipping changes safely (shared database)

Development and production share **one** Supabase database. So:

- **Migrations must be additive** (new tables, nullable columns) unless a plan says otherwise.
- **Never add an enum value and use it before the code that understands it is live in production.**
  Prisma throws as soon as old code reads a row with an unknown value. On 2026-10-02 this broke
  production sign-in when rows used `COLLEGE_HOD` before the HOD code was deployed.
- **Every PR targets `main`.** No stacked PRs (they merged into feature branches, not production).

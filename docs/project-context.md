# SelectIQ — Project Context (Living Document)

> **Last updated:** 2026-10-02
> **Purpose:** Single source of truth for project state. Manually updated after each feature build.
> **Used by:** Claude (planning), Claude Code (implementation), any new team member onboarding.

---

## 1. What is SelectIQ?

SelectIQ is an AI-powered Campus Recruitment and Assessment Platform targeting Indian engineering colleges.

**Phase 1 (current MVP focus):** A **mock placement drive** system for colleges, paired with **deep strength/weakness analytics and KPI dashboards** for three audiences — students, HODs, and college placement heads — so every student gets a continuously updated view of where they're strong and weak (across both topic **sections** and **skills**), and faculty can track cohort readiness ahead of real recruitment.

**Beyond MVP:** Secure, proctored online assessments with coding challenges, MCQs, and subjective evaluations inside a locked-down exam environment, extending later into a full real-recruitment marketplace (company profiles, jobs, applications, interviews, offers).

**Founder:** SG (solo founder, "vibe coder" — not deeply technical, uses AI-assisted development as primary engineering approach)

**Team:** Small founding team of friends at current stage, with a planned hiring roadmap.

### Operating standard — this is a real startup, not a college project

SelectIQ is SG's company and SG's risk. Colleges trust it with students' data, exam integrity and
placement outcomes. Everyone building it (people and AI tools) works to production standard:

- **Correctness and security before speed.** Server-side enforcement only, default deny, least privilege.
- **Real users, real data.** Never test against production data without cleaning up. Never leak one
  college's data to another, or one department's to another.
- **Every privileged action is audited and reversible** where possible (suspend, not delete).
- **Verify, don't assume.** Typecheck, lint and production build pass, plus an end-to-end check of the
  real flow, before anything is called done.
- **Ship safely.** Additive migrations on the shared database, PRs to `main` only, and nothing that
  breaks the live product mid-deploy.
- **Clear ownership.** Super Admin → College Admin → HOD → students. See
  [`roles-and-permissions.md`](roles-and-permissions.md).

---

## 2. Locked-In Tech Stack (Non-Negotiable)

| Layer | Technology | Notes |
|---|---|---|
| **Auth** | Firebase Auth | Google OAuth + GitHub OAuth + Phone OTP via MSG91 bridged into Firebase via custom tokens |
| **Phone OTP** | MSG91 | Chosen for DLT compliance with Indian carriers. Firebase Phone Auth's free tier used only for verification count management |
| **Database** | Supabase PostgreSQL | Replaces Neon. Consolidated DB + storage into one service |
| **File Storage** | Supabase Storage | Replaces Cloudflare R2. Same Supabase project as DB |
| **ORM** | Prisma | Handles ALL 142 structured data tables, migrations, type-safe queries. Non-negotiable — migration system, type safety, and AI code generation quality justify setup overhead |
| **Hosting** | Vercel | Next.js deployment |
| **Code Execution** | Judge0 CE (self-hosted) | For running candidate code submissions. Chosen after evaluating Piston (shut down Feb 2026), E2B (AI-agent focused), Rustbox (no free self-hosting) |
| **Secure Exam Browser** | Electron app | Already built. Registers `selectiq://` custom protocol + custom User-Agent |
| **Face Proctoring** | MediaPipe | Local face comparison — reference photo before exam, random in-exam snapshots |
| **Framework** | Next.js 14+ | App Router, TypeScript, Tailwind, shadcn/ui, Recharts |

**Explicitly excluded:** Neon, Cloudflare R2, Supabase Auth (Firebase handles all auth), Drizzle, Knex, raw SQL

**Data access rule:** Prisma handles ALL database access. Supabase client used ONLY for file storage operations. No exceptions.

---

## 3. Development Toolchain

| Tool | Role |
|---|---|
| **Claude (claude.ai)** | Planning, architecture, documentation, decision-making |
| **Claude Code (in Cursor)** | Primary implementation tool — agentic coding, connected inside Cursor |
| **Cursor / VS Code** | Editor surface; visual code inspection alongside Claude Code |
| **CLAUDE.md** | Auto-read by Claude Code on every session — architecture guardrails |
| **.cursorrules** | Same guardrails for Cursor |
| **docs/project-context.md** | This file — living state document, manually updated by SG |

**Environment:** Windows / PowerShell. Project at `C:\SelectIQ\SelectIQ\selectiq`.

---

## 4. Workflow (Strict — Claude Must Always Follow)

1. Claude writes implementation plans using the 9-section template
2. Claude pauses and asks for SG's approval — **never assumes and jumps ahead**
3. SG approves and instructs Claude Code to execute the plan
4. Claude Code executes following `CLAUDE.md` constraints, reports exact files changed, confirms build passes
5. SG tests manually
6. Claude provides copy-paste-ready updates for `docs/CHANGELOG.md` and `docs/project-context.md`; SG pastes them in manually

**Documentation updates are manual** — no files auto-update; Claude provides ready-to-paste text after each feature build.

---

## 5. Architecture Decisions Log

### Decided & Locked

- **Prisma over raw Supabase queries** — At 142 tables, migration system and type safety are essential. AI code generation quality is significantly better with Prisma's typed client. This decision must not be relitigated.
- **Supabase consolidation** — One service for DB + storage reduces operational complexity vs. Neon + Cloudflare R2.
- **MSG91 over Firebase Phone Auth** — DLT compliance is legally required for sending OTPs via Indian carriers. Firebase Phone Auth doesn't handle DLT registration.
- **Judge0 CE (self-hosted)** — Only viable free self-hosted option after evaluating alternatives.
- **Firebase for all auth** — Supabase Auth explicitly excluded. Firebase handles Google OAuth, GitHub OAuth, and custom tokens for MSG91 phone OTP.
- **Phase 1 = Mock Drive + Analytics, NOT the recruitment marketplace** — The MVP proves the mock-drive-plus-strength/weakness-analytics loop first. Company profiles, job postings, applications, interviews, and offers are deferred to Phase 2. This reordering is reflected in the renumbered plan sequence (see §6).
- **Strength/weakness diagnostic is built on BOTH axes** — topic **sections** (DSA, DBMS, Aptitude…) AND a **skill taxonomy** beneath them. Every diagnostic question must be tagged on both.
- **Three co-equal MVP dashboards** — Student, HOD, and Placement Head are three first-class deliverables, not one role-filtered view. All three call the SAME comparative-analytics services so numbers match across views.
- **Competency engine is deterministic in Phase 1** — Scoring rollups + rule-based weak-topic detection and recommendations. No ML, so every insight is explainable to a student or HOD.
- **Internal teams use feature branches, not forks.**
- **Non-compete clauses unenforceable in India** — Agreements focus on IP assignment, NDA, non-solicitation.
- **Production credentials stay with founders only** — Supabase service role key, Firebase Admin SDK, MSG91 keys, Vercel env vars never shared with developers at early stage.
- **Claude Code over standalone copy-paste** — Planning + execution stay close; CLAUDE.md provides the guardrails.

### Exam Link Enforcement (3-Layer Architecture)

1. **Electron app** registers `selectiq://` custom protocol + custom User-Agent
2. **Server middleware** intercepts exam-attempt routes and redirects non-Electron browsers to `/browser-required` gateway
3. **Gateway page** auto-fires deep link with download fallback

---

## 6. Plan Sequence & Phases (Renumbered — Canonical)

All implementation plans live in `docs/plans/` as three-digit files (`001-…` through `051-…`) plus `000-master-index.md`. This is the single canonical build order.

| Phase | Plans | Focus |
|---|---|---|
| **Foundation (Sprint 1)** | 001–010 | Next.js, env, DB, auth (Google/GitHub/OTP), RBAC, UI shell, storage, deploy |
| **Assessment Engine (Sprint 2)** | 011–020 | Question bank, assessment builder, candidates, Judge0, exam runtime, grading, SEB, proctoring, analytics, import/export |
| **⭐ Mock Drive + Analytics MVP (Phase 1)** | 021–031 | Section/skill taxonomy, HOD role + departments, mock drive (dual mode), drive runtime, competency scoring engine, weak-topic detection, **Student / HOD / Placement Head dashboards**, comparative analytics, reporting |
| **Recruitment Marketplace (Phase 2)** | 032–041 | Company profiles, job postings, hiring rounds, application pipeline, resume search, interviews, offers, real campus drives, student journey, recruitment analytics |
| **Platform Services (Phase 3)** | 042–051 | Notifications, real-time, search, background jobs, org settings, billing, audit, admin console, public API, email infra |

**Phase 1 build order is strict:** 021→022→023→024 (taxonomy → HOD/departments → mock drive setup → runtime) MUST precede the competency engine (025→026), which MUST precede the three dashboards (027 Student / 028 HOD / 029 Placement Head), then comparative analytics (030) and reporting (031).

> **Cross-reference note:** Plan bodies reference dependencies by pre-renumber labels; the old→new map lives in `docs/plans/000-master-index.md`. The competency engine was split from "25a/25b" into plans 025 and 026.

**Highest-risk plan in the MVP:** Plan 025 (competency scoring/rollup engine). Its math (difficulty weighting, cumulative aggregation, cohort baselines) must be hand-verified against paper calculations before anything is built on top of it.

**Access-control spine (as built):** `src/lib/auth/scope.ts` (department scope for every manager query) and `src/services/people.ts` (who may manage whom, plus every guard). The full model is in [`roles-and-permissions.md`](roles-and-permissions.md).

---

## 7. Current Status (2026-10-02)

**Live in production** (`selectiq-eta.vercel.app`, deployed from `main`):

- Foundation: Next.js App Router, Firebase auth (Google, GitHub, **email + password** with college-issued temporary passwords or set-password email), Prisma + Supabase, storage, path-based multi-tenancy (`/[college]/…`).
- Assessment engine: question bank, builder, candidates and batches, exam runtime, grading, proctoring, analytics, Excel/CSV import and export, PDF candidate reports.
- **Five roles with department scoping** (College HOD), a departments model, and a role-based welcome journey with story-mode login.
- Student experience: dashboard, Assessments, Analytics, My results, profile; Mock interviews marked "Soon".
- Forest & Marigold design system with motion.

**In progress:** admin panels for each role. Platform console (Super Admin), College admin panel, My department (HOD), account suspension, and Platform admins. See `roles-and-permissions.md`.

**People:** SG's `contactsuyashgupta@gmail.com` is the Super Admin. `suyash.22b0131169@abes.ac.in` is College Admin of ABES (test college).

**On hold, pending SG:** Plan 005 (MSG91 OTP), Plan 014 (Judge0), custom domain `selectsiq.in` (Firebase auth domain + Vercel), private Supabase bucket `resumes`.

---

## 8. Planned Future Work

| Timeline | Work |
|---|---|
| **Phase 1 (now)** | Plans 021–031 — Mock Drive + Analytics MVP (after Sprints 1–2 land) |
| **Phase 2** | Plans 032–041 — Recruitment marketplace (companies, jobs, applications, interviews, offers) |
| **Phase 3** | Plans 042–051 — Platform services (notifications, billing, admin, API) |
| **Investor deck** | 12-slide pitch deck complete (pptxgenjs, real brand colors navy ~#12213D / blue ~#3B6FD4, AICTE-grounded sizing). Placeholders remaining: traction counters, raise amount |
| **Repo scaling** | Phase 2 (5–20 devs): GitHub Team plan, least-privilege access. Larger scale: Turborepo monorepo (`selectiq-web`, `selectiq-electron`, `selectiq-proctoring`, `selectiq-question-bank`, `selectiq-shared`, `selectiq-infra`) |

---

## 9. Key Files Reference

| File | Purpose | Auto-read by |
|---|---|---|
| `.cursorrules` | Implementation constraints for Cursor | Cursor |
| `CLAUDE.md` | Architecture guardrails, stack rules, coding patterns | Claude Code |
| `docs/project-context.md` | Living state document (this file) | Manually referenced |
| `docs/CHANGELOG.md` | Feature-level change log | Manually referenced |
| `docs/plans/000-master-index.md` | Canonical plan sequence + old→new mapping | Manually referenced |
| `docs/plans/001-…` → `051-…` | Individual implementation plans (9-section format) | Manually referenced |
| `docs/plans/002-repo-security-phase1.md` | GitHub org security plan (separate from build sequence) | Manually referenced |

> **Note:** `002-repo-security-phase1.md` shares a numeric prefix with `002-environment-configuration.md` but is a standalone security note, not part of the build sequence. Consider renaming it (e.g. `security-repo-phase1.md`) to avoid confusion.

---

## 10. Principles & Patterns

- **AI-assisted development is the primary engineering approach** — SG is not deeply technical; Claude and Claude Code do the heavy lifting.
- **Plans are individual `.md` files** in `docs/plans/`, strict 9-section format: Objective, Scope, Prerequisites/Dependencies, Technical Approach, Implementation Steps, File Changes, Testing/Verification, Documentation Updates, Estimated Effort.
- **Three-file portable memory layer** — `.cursorrules`, `CLAUDE.md`, `docs/project-context.md` — survives chat/session resets and seeds new sessions.
- **Budget-conscious** — Free tiers and self-hosted solutions preferred where viable.
- **Plan → Approve → Execute → Test → Document** — Never skip steps.
- **No auto-updates to docs** — Claude provides ready-to-paste text; SG pastes manually.
- **Security by separation** — Production credentials never leave founders; legal agreements are the primary deterrent for contractors.
- **Production standard, always** — see "Operating standard" in §1. A mistake here costs real colleges and real students.
- **"Does this look AI-generated?" lens** — For pitch/product materials, prefer fewer words, more whitespace, warm non-techy aesthetics, story-based flow.

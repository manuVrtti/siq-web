# SelectIQ — Project Context (Living Document)

> **Last updated:** 2026-08-12
> **Purpose:** Single source of truth for project state. Manually updated after each feature build.
> **Used by:** Claude (planning), Claude Code (implementation), any new team member onboarding.

---

## 1. What is SelectIQ?

SelectIQ is an AI-powered Campus Recruitment and Assessment Platform targeting Indian engineering colleges. It enables companies to conduct secure, proctored online assessments with coding challenges, MCQs, and subjective evaluations — all within a locked-down exam environment.

**Founder:** SG (solo founder, "vibe coder" — not deeply technical, uses AI-assisted development as primary engineering approach)

**Team:** Small founding team of friends at current stage, with a planned hiring roadmap.

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
| **Face Proctoring** | MediaPipe | Local face comparison — reference photo before exam, random in-exam snapshots (Sprint 5) |
| **Framework** | Next.js | Full-stack React framework |

**Explicitly excluded:** Neon, Cloudflare R2, Supabase Auth (Firebase handles all auth)

**Data access rule:** Prisma handles ALL database access. Supabase client used ONLY for file storage operations. No exceptions.

---

## 3. Development Toolchain

| Tool | Role |
|---|---|
| **Claude (claude.ai)** | Planning, architecture, documentation, decision-making |
| **Claude Code** | Primary implementation tool — agentic coding from terminal |
| **VS Code** | Visual code inspection alongside Claude Code |
| **CLAUDE.md** | Auto-read by Claude Code on every session — architecture guardrails |
| **.cursorrules** | Available if Cursor is ever used — same guardrails |
| **docs/project-context.md** | This file — living state document, manually updated by SG |

**Previous toolchain note:** Cursor Pro was originally planned as the primary implementation tool. Shifted to Claude Code for reduced friction (no copy-paste workflow between Claude and Cursor). VS Code kept open alongside for visual inspection.

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
- **MSG91 over Firebase Phone Auth** — DLT (Distributed Ledger Technology) compliance is legally required for sending OTPs via Indian carriers. Firebase Phone Auth doesn't handle DLT registration.
- **Judge0 CE (self-hosted)** — Only viable free self-hosted option after evaluating alternatives.
- **Firebase for all auth** — Supabase Auth explicitly excluded. Firebase handles Google OAuth, GitHub OAuth, and custom tokens for MSG91 phone OTP.
- **Internal teams use feature branches, not forks** — Forking is an open-source contribution pattern, not an internal dev workflow.
- **Non-compete clauses unenforceable in India** — Contractor agreements focus on IP assignment, NDA, and non-solicitation instead.
- **Production credentials stay with founders only** — Supabase service role key, Firebase Admin SDK, MSG91 keys, Vercel env vars never shared with developers at early stage.
- **Claude Code over Cursor** — Reduced workflow friction; planning + execution stay closer together. CLAUDE.md provides the same guardrails that .cursorrules did for Cursor.

### Exam Link Enforcement (3-Layer Architecture)

1. **Electron app** registers `selectiq://` custom protocol + custom User-Agent (`SelectIQBrowser/{version}`)
2. **Server middleware** intercepts exam routes and redirects non-Electron browsers to `/browser-required` gateway
3. **Gateway page** auto-fires deep link with download fallback

---

## 6. Current Sprint Status

### Sprint 1 — Project Scaffolding (NOT STARTED)

Tasks:
- [ ] Next.js initialization
- [ ] Place foundation files (`.cursorrules`, `CLAUDE.md`, `docs/project-context.md`)
- [ ] Install dependencies (Prisma, Firebase SDK, Supabase client, etc.)
- [ ] Prisma init + initial schema
- [ ] Environment variables setup
- [ ] Folder structure
- [ ] First commit

---

## 7. Planned Future Work

| Timeline | Work |
|---|---|
| **Sprint 5** | Face snapshot proctoring (MediaPipe local comparison) |
| **Phase 1 (now)** | GitHub Organization setup — branch protection, CODEOWNERS, secret scanning. Plan at `docs/plans/002-repo-security-phase1.md` |
| **Phase 2 (5-10 devs)** | GitHub Team plan, least-privilege repo access, trunk-based development |
| **Phase 3 (20+ devs)** | Turborepo monorepo with natural seams: `selectiq-web`, `selectiq-electron`, `selectiq-proctoring`, `selectiq-question-bank`, `selectiq-shared`, `selectiq-infra` |

---

## 8. Key Files Reference

| File | Purpose | Auto-read by |
|---|---|---|
| `.cursorrules` | Implementation constraints for Cursor | Cursor (if used) |
| `CLAUDE.md` | Architecture guardrails, stack rules, coding patterns | Claude Code |
| `docs/project-context.md` | Living state document (this file) | Manually referenced |
| `docs/CHANGELOG.md` | Feature-level change log | Manually referenced |
| `docs/plans/002-repo-security-phase1.md` | GitHub org security plan | Manually referenced |

---

## 9. Principles & Patterns

- **AI-assisted development is the primary engineering approach** — SG is not deeply technical; Claude and Claude Code do the heavy lifting
- **Budget-conscious** — Free tiers and self-hosted solutions preferred where viable
- **Documentation-first** — Three foundation files form the portable memory layer across tools and accounts
- **Plan → Approve → Execute → Test → Document** — Never skip steps
- **No auto-updates to docs** — Claude provides ready-to-paste text; SG pastes manually
- **Security by separation** — Production credentials never leave founders; legal agreements are primary deterrent for contractors

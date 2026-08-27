# SelectIQ — Master Build Plan (Renumbered Sequence)

This is the canonical, single-sequence ordering of all SelectIQ implementation plans. Plans are numbered 001–051 in strict build order and grouped into phases. Each `.md` file in this folder is one Claude Code session input, following the standard 9-section format.

> **Cross-reference note:** Individual plan bodies were authored before this renumbering and may refer to dependencies by their *original* plan numbers (and the competency engine as "Plan 25a / 25b"). Use the mapping table at the bottom to translate any in-body "Plan NN" reference to its canonical number here. The dependency *relationships* remain correct; only the labels shifted.

---

## Phase 0 — Foundation (Sprint 1) · Plans 001–010
The authenticated, role-aware, deployed skeleton. Nothing domain-specific.

| # | Plan | Focus |
|---|------|-------|
| 001 | Next.js Project Scaffolding | App Router, TypeScript, Tailwind, structure |
| 002 | Environment & Configuration System | Zod-validated env, typed config |
| 003 | Prisma + Supabase Database Connection | ORM, core tables, DB health |
| 004 | Firebase Auth — Google & GitHub OAuth | OAuth + session cookies |
| 005 | MSG91 Phone OTP + Firebase Custom Tokens | DLT-compliant phone login |
| 006 | Auth Middleware & Route Protection | Route guards, getCurrentUser |
| 007 | Role-Based Access Control (RBAC) | Roles, permissions, org scoping |
| 008 | UI Foundation & Layout System | shadcn/ui, app shell, nav |
| 009 | Supabase Storage Integration | File upload/download |
| 010 | Error Handling, Health Checks & Deployment | Errors, health, Vercel deploy |

## Phase 0 — Assessment Engine (Sprint 2) · Plans 011–020
The core testing engine: questions → assessments → exams → grading → analytics.

| # | Plan | Focus |
|---|------|-------|
| 011 | Question Bank Schema & Management | Question types, tags, CRUD |
| 012 | Assessment Builder & Configuration | Sections, scoring, scheduling |
| 013 | Candidate Management & Assessment Assignment | Batches, tokens, invitations |
| 014 | Judge0 Code Execution Integration | Coding questions, test cases |
| 015 | Exam-Taking Runtime | Timed exam UI, autosave |
| 016 | Grading Engine & Results | Auto + manual grading |
| 017 | Exam Link Enforcement & Secure Browser Gateway | SEB lockdown |
| 018 | Proctoring: Face Snapshot & Activity Monitoring | Local MediaPipe |
| 019 | Analytics Dashboard & Reporting | Assessment/question analytics |
| 020 | Bulk Import, Export & Data Operations | CSV/Excel/PDF |

## ⭐ Phase 1 — Mock Drive + Analytics MVP · Plans 021–031
**The MVP thesis:** mock placement drives + deep strength/weakness analytics for students, HODs, and placement heads. Build these in order — 21→24 must precede all dashboards.

| # | Plan | Focus |
|---|------|-------|
| 021 | Section & Skill Taxonomy + Question Tagging | Two-axis competency foundation |
| 022 | HOD Role & Department Model | HOD + Placement Head roles, dept scoping |
| 023 | Mock Drive Orchestration (Dual Mode) | College-simulated + sample-company |
| 024 | Mock Drive Runtime & Student Participation | Students run the drive (data engine) |
| 025 | Competency Scoring & Rollup Engine | Section + skill scores *(was 25a)* |
| 026 | Weak-Topic Detection & Recommendations | Insights + practice *(was 25b)* |
| 027 | Student Dashboard: My Strengths & Weaknesses | **Dashboard #1** |
| 028 | HOD Dashboard: Department Cohort | **Dashboard #2** |
| 029 | Placement Head Dashboard: College-Wide Tracking | **Dashboard #3** |
| 030 | Comparative & Trend Analytics | Trends, percentiles, consistency |
| 031 | Reporting & Export | Report cards, dept/college reports |

## Phase 2 — Recruitment Marketplace · Plans 032–041
The real-employer hiring workflow. Deferred until the MVP loop is proven.

| # | Plan | Focus |
|---|------|-------|
| 032 | Company Profiles & Recruiter Onboarding | Employer accounts, partnerships |
| 033 | Job Postings & Role Management | Jobs, eligibility, targeting |
| 034 | Job–Assessment Linking & Hiring Rounds | Multi-round workflows |
| 035 | Application Pipeline & Candidate Tracking | ATS-style pipeline |
| 036 | Resume Management & Candidate Search | Resume parsing, sourcing |
| 037 | Interview Scheduling & Management | Slots, scorecards |
| 038 | Offer Management & Acceptance | Offers, placements |
| 039 | Campus Drive Orchestration | Real drive coordination |
| 040 | Student Dashboard & Placement Journey | Unified student journey |
| 041 | Recruitment Analytics & Placement Reporting | Placement stats, official reports |

## Phase 3 — Platform Services · Plans 042–051
Scale, operations, and integration infrastructure.

| # | Plan | Focus |
|---|------|-------|
| 042 | Notification System Core | Unified in-app/email/SMS |
| 043 | Real-Time Delivery & Live Updates | Push instead of polling |
| 044 | Search & Discovery Infrastructure | Full-text search |
| 045 | Background Jobs & Async Processing | Job queue |
| 046 | Organization Settings & Multi-User Onboarding | Team management |
| 047 | Billing & Subscription Management | Plans, usage limits |
| 048 | Audit Logging & Activity Trails | Compliance |
| 049 | Admin Console & Platform Operations | SuperAdmin ops |
| 050 | Public API & Webhooks Platform | External integrations |
| 051 | Email Infrastructure & Communication Templates | Deliverability |

---

## Renumbering Map (old → new)

For translating in-body "Plan NN" references. Original files lived either in the root plans folder or the `phase-1/` subfolder.

| New # | Old label | Original location |
|-------|-----------|-------------------|
| 001–020 | Plan 01–20 | root (unchanged) |
| 021 | Plan 21 (Phase 1) | phase-1/ |
| 022 | Plan 22 (Phase 1) | phase-1/ |
| 023 | Plan 23 (Phase 1) | phase-1/ |
| 024 | Plan 24 (Phase 1) | phase-1/ |
| 025 | Plan 25a (Phase 1) | phase-1/ |
| 026 | Plan 25b (Phase 1) | phase-1/ |
| 027 | Plan 26 (Phase 1) | phase-1/ |
| 028 | Plan 27 (Phase 1) | phase-1/ |
| 029 | Plan 28 (Phase 1) | phase-1/ |
| 030 | Plan 29 (Phase 1) | phase-1/ |
| 031 | Plan 30 (Phase 1) | phase-1/ |
| 032 | Plan 21 (recruitment) | root |
| 033 | Plan 22 (recruitment) | root |
| 034 | Plan 23 (recruitment) | root |
| 035 | Plan 24 (recruitment) | root |
| 036 | Plan 25 (recruitment) | root |
| 037 | Plan 26 (recruitment) | root |
| 038 | Plan 27 (recruitment) | root |
| 039 | Plan 28 (recruitment) | root |
| 040 | Plan 29 (recruitment) | root |
| 041 | Plan 30 (recruitment) | root |
| 042 | Plan 31 | root |
| 043 | Plan 32 | root |
| 044 | Plan 33 | root |
| 045 | Plan 34 | root |
| 046 | Plan 35 | root |
| 047 | Plan 36 | root |
| 048 | Plan 37 | root |
| 049 | Plan 38 | root |
| 050 | Plan 39 | root |
| 051 | Plan 40 | root |

**Total: 51 plans** (~048–055 hrs of Claude Code execution across all phases).

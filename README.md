# SelectIQ

AI-powered campus recruitment and assessment platform for Indian engineering
colleges. Companies run proctored assessments — coding challenges, MCQs and
subjective evaluation — inside a locked-down Electron exam browser.

Architecture and implementation rules live in [CLAUDE.md](CLAUDE.md). Current
project state lives in [docs/project-context.md](docs/project-context.md).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Auth | Firebase Auth — Google, GitHub, phone OTP |
| Phone OTP | MSG91 (DLT compliance for Indian carriers) |
| Database | Supabase PostgreSQL |
| ORM | Prisma — all database access, no exceptions |
| File storage | Supabase Storage |
| Hosting | Vercel |
| Code execution | Judge0 CE (self-hosted) |
| Exam browser | Electron (separate repo) |

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Enable the pre-commit secret guard

**Do this before your first commit.** Git does not track hook activation, so a
fresh clone has no protection until you run:

```bash
git config core.hooksPath .githooks
```

This blocks commits containing credential-shaped strings. See
[docs/plans/002-repo-security-phase1.md](docs/plans/002-repo-security-phase1.md).

### 3. Environment variables

Two git-ignored files, split deliberately:

| File | Holds | Why |
|---|---|---|
| `.env` | `DATABASE_URL`, `DIRECT_URL` | The Prisma CLI reads `.env` only — it never reads `.env.local` |
| `.env.local` | Everything else | Next.js reads both; `.env.local` wins on conflict |

`.env.example` is the committed template. It must contain placeholders only —
never real values.

Keeping the database URLs in exactly one file matters: if both files define
`DATABASE_URL` and they drift, Next.js and the Prisma CLI will silently point at
different databases.

Copy `.env.example` to `.env.local` and fill in what you need. Nothing is
required to boot the app — each variable is only needed by the feature that
uses it.

**Supabase connection strings.** Take both from Project Settings → Database →
Connection string:

- `DATABASE_URL` → **Transaction pooler**, port 6543 (serverless-safe)
- `DIRECT_URL` → **Session pooler**, port 5432 (used by migrations)

Use the pooler hosts (`...pooler.supabase.com`), not `db.<ref>.supabase.co`.
The latter is IPv6-only on the free tier and will hang on most Indian ISPs.
Pooler usernames are `postgres.<project-ref>`, not plain `postgres`.

### 4. Database

```bash
npx prisma generate          # after any schema change
npx prisma migrate dev       # apply schema changes locally
```

### 5. Run

```bash
npm run dev
```

http://localhost:3000 — health check at `/api/health`.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

---

## Data access rules

These are not stylistic preferences. Violating them breaks the architecture:

- **Prisma** — every database read and write. No raw SQL.
- **Supabase client** — file storage only. Never for database queries.
- **Firebase Admin** — authentication only. Never for data storage.

Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`,
`MSG91_AUTH_KEY`) must never carry a `NEXT_PUBLIC_` prefix and must never be
logged.

---

## Layout

```
prisma/schema.prisma          Database schema and migrations
src/app/(auth)/               Auth pages
src/app/(dashboard)/          Dashboard pages
src/app/(exam)/               Exam pages — gated by src/proxy.ts
src/app/browser-required/     Electron gateway page
src/app/api/                  API routes
src/lib/                      prisma, supabase, firebase-client,
                              firebase-admin, msg91
src/proxy.ts                  Route interception (Next.js 16 renamed the
                              middleware convention to proxy)
src/types/                    Shared TypeScript types
```

---

## Branching

Short-lived branches off `main`, one per unit of work, merged by PR and then
deleted. Long-running branches per feature area drift from `main` and become
painful to merge.

```
feat/auth-phone-otp
fix/health-route-caching
chore/repo-security-codeowners
```

Security-critical paths are owned per [.github/CODEOWNERS](.github/CODEOWNERS).
Owner review is enforced once branch protection on `main` enables
"Require review from Code Owners".

# CLAUDE.md — SelectIQ Architecture & Implementation Guide

> **Auto-read by Claude Code on every session.**
> **Last updated:** 2026-10-02
> **This file is the single source of implementation truth. Follow it exactly.**

---

## Project Overview

SelectIQ is an AI-powered Campus Recruitment and Assessment Platform for Indian engineering colleges. It enables companies to conduct secure, proctored online assessments (coding challenges, MCQs, subjective evaluations) within a locked-down Electron-based exam browser.

**Founder:** SG — non-technical ("vibe coder"), uses AI-assisted development as primary engineering approach.

### Production standard (non-negotiable)

SelectIQ is a **real startup with real colleges, real students and real risk**, not a college project.
Work like it:

- Enforce access on the server, default deny, least privilege. Never trust a client-sent id.
- Never leak data across colleges or departments. Every manager query goes through `src/lib/auth/scope.ts`.
- Audit every privileged change (`services/audit.ts`). Prefer reversible actions (suspend, not delete).
- Prove it works: typecheck, lint, production build, and an end-to-end check of the real flow. Clean up any test data.
- Dev and prod share one database. Use **additive migrations only**, and never use a new enum value before the code that reads it is live.
- Every PR targets `main`. No stacked PRs.

### Roles (5) and who manages whom

**Super Admin** → everything (all colleges, College Admins, HODs, students, recruiters).
**College Admin** → everything in their own college (other admins, HODs, departments, students).
**College HOD** → students, tests and results of the departments they head.
**Recruiter** → their company workspace. **Student** → themselves.
Source of truth: `docs/roles-and-permissions.md` + `src/services/people.ts`. Keep them in sync.

---

## Tech Stack (Non-Negotiable — Never Suggest Alternatives)

| Layer | Technology | Rule |
|---|---|---|
| **Framework** | Next.js (App Router) | Full-stack — pages, API routes, middleware |
| **Auth** | Firebase Auth | Google OAuth + GitHub OAuth + Phone OTP (MSG91 → Firebase custom tokens) |
| **Phone OTP** | MSG91 | DLT compliance for Indian carriers. Firebase Phone Auth free tier for verification count only |
| **Database** | Supabase PostgreSQL | Single Supabase project for DB + storage |
| **File Storage** | Supabase Storage | Same Supabase project. Used via Supabase client |
| **ORM** | Prisma | ALL 142 tables. ALL database reads/writes. No exceptions |
| **Hosting** | Vercel | Production deployment |
| **Code Execution** | Judge0 CE (self-hosted) | Candidate code submissions |
| **Secure Exam Browser** | Electron | Already built. Existing asset — do not rebuild |
| **Face Proctoring** | MediaPipe | Local face comparison (Sprint 5) |

### Explicitly Excluded — Never Use These

- **Neon** — replaced by Supabase PostgreSQL
- **Cloudflare R2** — replaced by Supabase Storage
- **Supabase Auth** — Firebase handles ALL auth
- **Drizzle / Knex / raw SQL** — Prisma is the only ORM
- **Firebase Firestore / Realtime DB** — Supabase PostgreSQL is the only database

---

## Data Access Rules (Critical)

```
┌─────────────────────────────────────────────────┐
│  Prisma    → ALL database operations            │
│              (queries, mutations, migrations)    │
│                                                  │
│  Supabase  → ONLY file storage operations       │
│  Client      (upload, download, signed URLs)    │
│                                                  │
│  Firebase  → ONLY authentication                │
│  Admin SDK   (verify tokens, create custom      │
│               tokens, manage users)             │
└─────────────────────────────────────────────────┘
```

- **Never** use Supabase client for database queries
- **Never** use Prisma for file storage
- **Never** use Firebase for data storage
- **Never** bypass Prisma with raw SQL unless explicitly instructed

---

## Auth Architecture

```
Phone OTP Flow:
  User enters phone → MSG91 sends OTP (DLT compliant) →
  User verifies OTP with MSG91 → Server creates Firebase custom token →
  Client signs in with custom token → Firebase session established

OAuth Flow:
  User clicks Google/GitHub → Firebase Auth popup →
  Firebase returns credential → Session established

All Routes:
  Client sends Firebase ID token → Server middleware verifies with
  Firebase Admin SDK → Extract user identity → Prisma queries for
  app-level data (roles, permissions, profiles)
```

---

## Exam Link Enforcement (3-Layer Architecture)

```
Layer 1 — Electron App:
  Registers selectiq:// custom protocol
  Sets custom User-Agent: SelectIQBrowser/{version}

Layer 2 — Server Middleware:
  Intercepts all /exam/* routes
  Checks User-Agent for SelectIQBrowser
  Redirects non-Electron browsers → /browser-required

Layer 3 — Gateway Page (/browser-required):
  Auto-fires selectiq:// deep link
  Shows download fallback if Electron not installed
```

---

## Development Toolchain

| Tool | Role |
|---|---|
| **Claude (claude.ai)** | Planning, architecture, documentation, decision-making |
| **Claude Code** | **Primary implementation tool** — agentic coding from terminal |
| **VS Code** | Visual code inspection alongside Claude Code |
| **Cursor** | Backup only — not primary. `.cursorrules` kept in repo for compatibility |

---

## Workflow (Strict)

```
1. Claude (claude.ai) writes implementation plan → 9-section template
2. SG reviews and approves — NEVER skip this step
3. SG instructs Claude Code to execute the approved plan
4. Claude Code executes:
   - Creates/modifies files
   - Installs dependencies
   - Runs builds
   - Fixes errors
   - Reports exact files changed
   - Confirms build passes
5. SG tests manually
6. Claude (claude.ai) provides copy-paste-ready updates for:
   - docs/CHANGELOG.md
   - docs/project-context.md
7. SG pastes updates manually
```

**Documentation updates are ALWAYS manual.** No tool auto-updates docs.

---

## Claude Code Rules

- **You ARE the implementation tool.** Execute code, create files, install deps, run builds.
- **You are NOT the planning tool.** Plans come from Claude on claude.ai. Follow them.
- **Always read this file** before starting any work session.
- **Never modify** `.cursorrules`, `CLAUDE.md`, or `docs/project-context.md` without explicit instruction from SG.
- **Always confirm build passes** (`npm run build` or equivalent) before reporting task completion.
- **Report exact files** created, modified, or deleted after every task.
- **Ask before proceeding** if the plan is ambiguous. Do not guess.
- **Never install packages** not specified in the plan without asking first.
- **Run `npx prisma generate`** after any schema change.
- **Run `npx prisma migrate dev`** after any schema change in development.
- **Never expose secrets** in code, logs, or commit messages.

---

## Folder Structure (Target)

```
selectiq/
├── .cursorrules                  # Cursor backup config
├── CLAUDE.md                     # This file (Claude Code reads this)
├── next.config.js
├── package.json
├── prisma/
│   ├── schema.prisma             # All 142 tables defined here
│   └── migrations/               # Prisma migration history
├── src/
│   ├── app/                      # Next.js App Router pages
│   │   ├── (auth)/               # Auth-related pages
│   │   ├── (dashboard)/          # Dashboard pages
│   │   ├── (exam)/               # Exam pages (middleware-protected)
│   │   ├── browser-required/     # Electron gateway page
│   │   ├── api/                  # API routes
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/               # React components
│   │   ├── ui/                   # Shared UI primitives
│   │   └── features/             # Feature-specific components
│   ├── lib/                      # Shared utilities
│   │   ├── prisma.ts             # Prisma client singleton
│   │   ├── supabase.ts           # Supabase client (storage only)
│   │   ├── firebase-admin.ts     # Firebase Admin SDK (server-side)
│   │   ├── firebase-client.ts    # Firebase client SDK (browser-side)
│   │   └── msg91.ts              # MSG91 OTP integration
│   ├── proxy.ts                  # Next.js proxy (auth + exam browser check)
│   └── types/                    # TypeScript type definitions
├── docs/
│   ├── project-context.md        # Living state document
│   ├── CHANGELOG.md              # Feature change log
│   └── plans/                    # Implementation plans
│       └── 002-repo-security-phase1.md
├── public/                       # Static assets
└── .env.local                    # Environment variables (git-ignored)
```

---

## Environment Variables

```env
# .env.local — NEVER commit this file

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # Server-side only. NEVER expose to client.

# Prisma
DATABASE_URL=                         # Supabase PostgreSQL connection string

# Firebase Client (public — safe for browser)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Firebase Admin (server-side only — NEVER expose)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# MSG91
MSG91_AUTH_KEY=                        # Server-side only
MSG91_TEMPLATE_ID=
MSG91_SENDER_ID=

# Judge0
JUDGE0_API_URL=                       # Self-hosted instance URL
JUDGE0_API_KEY=                       # If configured
```

**Security rule:** `SUPABASE_SERVICE_ROLE_KEY`, `FIREBASE_ADMIN_PRIVATE_KEY`, `MSG91_AUTH_KEY` are **server-side only**. Never prefix with `NEXT_PUBLIC_`. Never log them. Never share with developers — founders only at current stage.

---

## Coding Patterns

### Prisma Client Singleton

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Supabase Client (Storage Only)

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Client-side — for file uploads from browser
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Server-side — for signed URLs, admin storage operations
// Use SUPABASE_SERVICE_ROLE_KEY only in API routes / server actions
```

### API Route Pattern

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyFirebaseToken } from '@/lib/firebase-admin'

export async function GET(request: NextRequest) {
  try {
    // 1. Verify auth
    const token = request.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const decodedToken = await verifyFirebaseToken(token)

    // 2. Use Prisma for data access
    const data = await prisma.someTable.findMany({
      where: { userId: decodedToken.uid }
    })

    // 3. Return response
    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
```

---

## Security Rules

- **Never commit `.env.local`** — it's in `.gitignore`
- **Never hardcode secrets** in source code
- **Never use `NEXT_PUBLIC_` prefix** for server-only keys
- **Never share production credentials** with developers — founders only
- **Never log sensitive tokens** (Firebase ID tokens, service role keys)
- **Always validate Firebase ID tokens** on server-side before processing requests
- **Always use parameterized queries** via Prisma (prevents SQL injection by default)
- **CODEOWNERS file** should list SG as owner of: `prisma/`, `src/proxy.ts`, `src/lib/firebase-admin.ts`, `.env*`, `CLAUDE.md`, `.cursorrules`

---

## What NOT To Do

1. ❌ Don't suggest replacing any part of the locked-in stack
2. ❌ Don't use Supabase client for database queries — use Prisma
3. ❌ Don't use Firebase for data storage — use Supabase PostgreSQL via Prisma
4. ❌ Don't skip the build check before reporting task completion
5. ❌ Don't auto-update documentation files — provide text for SG to paste
6. ❌ Don't install packages without them being in the approved plan
7. ❌ Don't modify CLAUDE.md, .cursorrules, or project-context.md without explicit instruction
8. ❌ Don't use `pages/` directory — use App Router (`app/`) only
9. ❌ Don't create API routes that skip Firebase auth verification
10. ❌ Don't assume — ask if the plan is unclear

---

## Quick Reference

| Question | Answer |
|---|---|
| How do I query the database? | `import { prisma } from '@/lib/prisma'` |
| How do I upload a file? | `import { supabase } from '@/lib/supabase'` → `.storage.from('bucket').upload()` |
| How do I verify a user? | `import { verifyFirebaseToken } from '@/lib/firebase-admin'` |
| How do I send an OTP? | Server-side call to MSG91 API → create Firebase custom token |
| Where do exam routes live? | `src/app/(exam)/` — protected by middleware User-Agent check |
| Where is the schema? | `prisma/schema.prisma` — run `npx prisma generate` after changes |
| Where are env vars? | `.env.local` (local) / Vercel dashboard (production) |
| What's the current sprint? | Check `docs/project-context.md` |

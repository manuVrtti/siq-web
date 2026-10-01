# Environments — keeping development off production

> **Last updated:** 2026-10-02 · **Owner:** SG

## Why

Until now, local development and the live site shared **one** Supabase project. That means:

- every local test reads and writes **real colleges' data**;
- a schema change made locally is live in production immediately. On 2026-10-02 a new role value
  broke production sign-in this way;
- PR preview deployments use the production database too.

For a real product this has to stop. The target:

| Environment | Database + storage | Firebase | Who uses it |
|---|---|---|---|
| **Production** | Supabase project `ujuywjvrhianxoyfebcw` (current) | `selectsiq26` | Real colleges. `main` → Vercel Production |
| **Development / Preview** | **New** Supabase project (free tier) | `selectsiq26` for now | Your laptop + every PR preview |

Firebase stays shared for now. Sign-ins create rows only in whichever database the app points at,
so this is safe. Split Firebase later, when other developers join.

## Steps (about 15 minutes)

### 1. Create the development Supabase project *(SG — needs your Supabase login)*
1. supabase.com → **New project** → name `selectiq-dev`, region **South Asia (Mumbai)**, a strong DB password.
2. When it's ready, copy three things:
   - **Settings → Database → Connection string**:
     - *Transaction pooler* (port **6543**) → this becomes `DATABASE_URL` (add `?pgbouncer=true`).
     - *Session pooler* (port **5432**) → this becomes `DIRECT_URL`.
   - **Settings → API**: Project URL, `anon` key and `service_role` key.

### 2. Point your laptop at it *(SG — env files are yours)*
- In **`.env`**, replace `DATABASE_URL` and `DIRECT_URL` with the dev values.
- In **`.env.local`**, replace `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` with the dev values.
- Keep a copy of the production values somewhere safe (a password manager), never in the repo.

### 3. Check and build the dev database
```bash
npm run db:which                       # all three must say (development)
npm run db:setup-dev -- --super-admin contactsuyashgupta@gmail.com
```
`db:setup-dev` applies every migration, creates the storage buckets (`avatars`, `org-logos`, private
`resumes`) and adds a **demo college** (`/demo`) with 3 departments, a College Admin, an HOD,
30 students and a draft test. It also makes your account Super Admin there. **It refuses to run if
anything points at production.**

### 4. Point Vercel *Preview* deployments at development *(SG — Vercel dashboard)*
Vercel → project `selectiq` → **Settings → Environment Variables**. For each of `DATABASE_URL`,
`DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY`:
- **Production** keeps the current (production) value.
- **Preview** gets the **development** value.

From then on, a PR preview can never touch real data. Production migrations still run only on
production deploys (`scripts/vercel-build.mjs`).

### 5. Tell Claude Code "dev DB is ready"
It re-runs `npm run db:which` to confirm, then all end-to-end tests run against development only.

## Rules from now on
- `npm run db:which` before any database work. If it says **PRODUCTION**, stop.
- Migrations reach production only through a merged PR to `main` (the Vercel production build).
- Never copy production data into development. Use `db:setup-dev`'s demo data, or anonymised exports.
- Production credentials stay with founders only (see `CLAUDE.md`).

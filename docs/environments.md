# Environments — keeping development off production

> **Last updated:** 2026-10-02 · **Owner:** SG

> ## ⏳ Status: PENDING (deferred by SG on 2026-10-02)
> Development, tests and Vercel Preview **still use the production database**
> (`npm run db:which` shows **PRODUCTION**). SG chose to do the separation later, using a **separate free
> Supabase project** rather than a Supabase branch (branching is paid; the org is on the Free plan).
>
> **Until it's done:**
> - Migrations must only **add** things (new tables, nullable columns). Never use a new enum value before
>   the code that reads it is live in production.
> - End-to-end tests act **only through throwaway users** (`zz…@example.com`) and clean up after
>   themselves, including their audit-log rows.
> - Read every schema change before it runs. The database is production.
>
> **Reminder:** Claude Code reminds SG before database-heavy work and before onboarding a real second
> college. When ready, follow the steps below, then tell Claude Code **"dev is ready"**.

## Why

Local development and the live site share **one** Supabase project. That means:

- every local test reads and writes **real colleges' data**;
- a schema change made locally is live in production immediately. On 2026-10-02 a new role value
  broke production sign-in this way;
- PR preview deployments use the production database too.

The target:

| Environment | Database + storage | Firebase | Used by |
|---|---|---|---|
| **Production** | Supabase project `ujuywjvrhianxoyfebcw` (current) | `selectsiq26` | Real colleges. `main` → Vercel Production |
| **Development / Preview** | **New** free Supabase project `selectiq-dev` | `selectsiq26` for now | Your laptop + every PR preview |

Firebase stays shared for now. Sign-ins create rows only in whichever database the app points at, so
this is safe. Split Firebase later, when other developers join.

## Steps (about 15 minutes)

### Part 1 — Create the dev project (Supabase)
1. [supabase.com/dashboard](https://supabase.com/dashboard) → **project switcher** (the ⌄ next to `selectiq`) → **New project**.
2. Fill in:
   - **Organization:** manuvrtti (Free)
   - **Name:** `selectiq-dev`
   - **Database password:** **Generate**, then save it in your password manager now.
   - **Region:** **South Asia (Mumbai)**, the same as production.
3. **Create new project** and wait about 2 minutes until it shows as healthy.

### Part 2 — Back up production values (important)
4. Copy these 5 lines from **`.env`** and **`.env.local`** into your password manager, labelled
   **"SelectIQ PRODUCTION"**: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

### Part 3 — Point your laptop at dev (env files are SG's)
5. In **selectiq-dev** → **Connect** → **ORMs** → **Prisma**. In both lines, replace `[YOUR-PASSWORD]`
   with the password from step 2. Put them in **`.env`**:
   ```
   DATABASE_URL="postgresql://postgres.<dev-ref>:<password>@…pooler.supabase.com:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres.<dev-ref>:<password>@…pooler.supabase.com:5432/postgres"
   ```
6. **Project Settings → API Keys → "Legacy API Keys"** (the same kind as production). Put these in **`.env.local`**:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<dev-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role secret key>
   ```
   The project URL is on **Project Settings → Data API**. **Leave every Firebase line unchanged.**

### Part 4 — Build the dev database (VS Code terminal)
7. `npm run db:which`: all 3 lines must say **(development)**. If any says **PRODUCTION**, stop and fix it.
8. `npm run db:setup-dev -- --super-admin contactsuyashgupta@gmail.com`
   It applies every migration, creates the storage buckets (`avatars`, `org-logos`, private `resumes`)
   and adds a **demo college** (`/demo`) with 3 departments, a College Admin, an HOD, 30 students and a
   draft test, with SG as Super Admin. **It refuses to run if anything points at production.**
9. Restart `npm run dev`, open `http://localhost:3000` and sign in with `contactsuyashgupta@gmail.com`.

### Part 5 — Make Vercel previews use dev
10. [vercel.com](https://vercel.com) → project **selectiq** → **Settings → Environment Variables**.
11. For each of the 5 variables:
    - Edit the existing one → untick **Preview** (leave it **Production only**).
    - **Add New** with the same name and the **dev** value → **Preview** (and Development if wanted).
12. Production stays exactly as it is. Migrations still reach production only through the Vercel
    production build (`scripts/vercel-build.mjs`).

### Part 6 — Tell Claude Code "dev is ready"
It confirms with `db:which`, runs every end-to-end suite against dev, checks a PR preview really uses
dev, and updates this status to **DONE**.

### Troubleshooting
- **Password errors in step 8:** the password in `DATABASE_URL` or `DIRECT_URL` is wrong, or still says `[YOUR-PASSWORD]`.
- **`db:which` says "unknown":** a URL was pasted wrong; recopy it from Connect.
- **Want production back locally:** paste the 5 saved lines back.

## Rules once it's done
- `npm run db:which` before any database work. If it says **PRODUCTION**, stop.
- Migrations reach production only through a merged PR to `main` (the Vercel production build).
- Never copy production data into development. Use `db:setup-dev`'s demo data or anonymised exports.
- Production credentials stay with founders only (see `CLAUDE.md`).

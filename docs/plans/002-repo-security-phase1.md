# Plan 002 — Repo Security, Phase 1

> **Status:** In progress
> **Created:** 2026-08-14
> **Note on provenance:** Drafted by Claude Code at SG's instruction because the
> file referenced by `CLAUDE.md` and `docs/project-context.md` did not exist in
> the repo. Section structure is inferred — the canonical 9-section template is
> not defined anywhere in the repo and should be reconciled by SG.

---

## 1. Objective

Make it structurally impossible to commit a credential to the SelectIQ repo, and
require owner review on the paths where a mistake is expensive.

## 2. Background

During Sprint 1 scaffolding, a real `SUPABASE_SERVICE_ROLE_KEY` was written into
`.env.example` — the one env file that is **not** git-ignored. It was caught by a
manual pre-commit scan, not by any automated control. Nothing leaked.

The control gap is real: today the only thing standing between a service-role key
and GitHub is someone remembering to look. That key bypasses row-level security
entirely, granting full read/write on every table.

## 3. Scope

**In scope**

- Branch protection on `main`
- CODEOWNERS enforcement
- GitHub secret scanning + push protection
- A local pre-commit secret scan that works regardless of GitHub plan tier
- Remediation of the credentials currently sitting in `.env.example`

**Out of scope**

- GitHub Organization migration — deferred to Phase 2 (5–10 devs)
- Least-privilege repo access, GitHub Team plan — Phase 2
- Turborepo monorepo split — Phase 3

## 4. Prerequisites

- `origin/main` exists — done (`2273804`)
- `.github/CODEOWNERS` — done (`6bf63f9`), PR open on
  `chore/repo-security-codeowners`
- **Open question:** is `selectiq` public or private? Secret scanning is free on
  public repos; on private repos it requires the paid GitHub Secret Protection
  add-on. This determines whether step 5.3 is available at all.

## 5. Implementation steps

1. Merge the CODEOWNERS PR.
2. **Settings → Branches** → add a rule for `main`:
   - Require a pull request before merging
   - Require review from Code Owners
   - Do not allow bypassing the above settings
3. **Settings → Code security and analysis**:
   - Enable Secret scanning
   - Enable Push protection

   If the repo is private and these are unavailable, step 4 becomes the primary
   control rather than a backstop.
4. Install a local pre-commit hook (`.githooks/pre-commit`, wired via
   `core.hooksPath`) that blocks staged content matching known credential
   patterns, and blocks `.env` / `.env.local` from being staged at all.
   Deliberately dependency-free — no husky, no lint-staged.
5. Reset `.env.example` to placeholder values. Move the real Supabase URL, anon
   key and service-role key into `.env.local`.
6. Commit the cleaned `.env.example`.

## 6. Files changed

| File | Change |
|---|---|
| `.github/CODEOWNERS` | Added — already committed (`6bf63f9`) |
| `.githooks/pre-commit` | New — dependency-free secret scan |
| `docs/plans/002-repo-security-phase1.md` | New — this file |
| `.env.example` | Values replaced with placeholders (SG's action) |

No application code changes. No new npm dependencies.

## 7. Verification

- Attempt a direct push to `main` → must be rejected.
- Open a PR touching `prisma/` → must request review from `@manuVrtti`.
- Stage a dummy string matching a known secret pattern and commit → must be
  blocked by the local hook.
- `git log -p -- .env.example` → shows no real credentials anywhere in history.

## 8. Risks

- **Lockout.** Branch protection with no bypass can block a solo founder from an
  urgent hotfix. Mitigation: SG retains admin and can temporarily disable the
  rule.
- **Plan tier.** Secret scanning on private repos is a paid add-on. If
  unavailable, the local hook is the only control — and it does not protect
  against `git commit --no-verify`, nor does it run on a fresh clone until
  `core.hooksPath` is configured.
- **Rotation blast radius.** Rotating the service-role key invalidates it
  everywhere simultaneously. Nothing consumes it yet, so rotating now is
  materially cheaper than rotating post-launch.

## 9. Definition of done

- [ ] `main` cannot receive a direct push
- [ ] A PR touching an owned path cannot merge without SG review
- [ ] `.env.example` contains only placeholders, and is committed
- [ ] A deliberate test secret is blocked before it reaches GitHub

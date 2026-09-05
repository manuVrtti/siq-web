#!/usr/bin/env bash
#
# Push local environment variables to Vercel.
#
# Reads .env and .env.local (both git-ignored) and sets every variable on the
# Vercel project, so the env-var step of a deploy is one command instead of
# fifteen hand-pastes — which is also how the FIREBASE_ADMIN_PRIVATE_KEY paste
# stops going wrong.
#
# Prerequisites (run once, in this folder):
#   npm i -g vercel
#   vercel login
#   vercel link
#
# Usage:
#   bash scripts/vercel-env-push.sh                 # push to production, preview, development
#   bash scripts/vercel-env-push.sh production       # one scope only
#   DRY_RUN=1 bash scripts/vercel-env-push.sh        # print what WOULD be pushed, values masked
#
# Notes:
#   - .env is read before .env.local, so the DB URLs in .env win over any
#     duplicate in .env.local (they are canonical in .env).
#   - Quotes around a value are stripped the way dotenv strips them, so the
#     private key lands with literal \n and no wrapping quotes — exactly what
#     the app expects.
#   - Empty values (unconfigured MSG91/Judge0) are skipped.
#   - NEXT_PUBLIC_APP_URL and NODE_ENV are skipped: the first must point at the
#     real production URL (set it after the first deploy), the second is managed
#     by Vercel.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILES=("$ROOT/.env" "$ROOT/.env.local")
DRY_RUN="${DRY_RUN:-0}"

SCOPES=("$@")
if [ ${#SCOPES[@]} -eq 0 ]; then SCOPES=(production preview development); fi

# Never push these — see header.
SKIP_KEYS=" NEXT_PUBLIC_APP_URL NODE_ENV "

if [ "$DRY_RUN" != "1" ]; then
  command -v vercel >/dev/null 2>&1 || { echo "vercel CLI not found — run: npm i -g vercel"; exit 1; }
  [ -f "$ROOT/.vercel/project.json" ] || { echo "Project not linked — run: vercel link"; exit 1; }
fi

# Mask a secret for dry-run output: show first 4 chars + length.
mask() { local v="$1"; printf '%s…(%d chars)' "${v:0:4}" "${#v}"; }

declare -A SEEN

push() {
  local key="$1" val="$2" scope
  for scope in "${SCOPES[@]}"; do
    if [ "$DRY_RUN" = "1" ]; then
      echo "  would set  $key ($scope) = $(mask "$val")"
      continue
    fi
    # Replace an existing value: remove (ignore if absent), then add.
    vercel env rm "$key" "$scope" -y >/dev/null 2>&1 || true
    if printf '%s' "$val" | vercel env add "$key" "$scope" >/dev/null 2>&1; then
      echo "  set   $key ($scope)"
    else
      echo "  FAIL  $key ($scope)"
    fi
  done
}

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  echo "== $(basename "$f") =="
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line#$'\xEF\xBB\xBF'}"              # strip UTF-8 BOM (PowerShell utf8 adds one)
    line="${line%$'\r'}"                        # strip trailing CR (Windows CRLF)
    case "$line" in ''|\#*) continue ;; esac   # skip blanks and comments
    case "$line" in *=*) ;; *) continue ;; esac # must be KEY=VALUE

    key="${line%%=*}"
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    val="${line#*=}"
    # Trim surrounding whitespace the way dotenv does (before quote-stripping),
    # so a stray trailing space on a line does not defeat the quote removal.
    val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

    [ -n "${SEEN[$key]:-}" ] && continue          # first file wins
    case "$SKIP_KEYS" in *" $key "*) echo "  skip  $key (managed manually)"; SEEN[$key]=1; continue ;; esac

    # Strip one leading and one trailing double quote, if both present.
    if [ "${val#\"}" != "$val" ] && [ "${val%\"}" != "$val" ]; then
      val="${val#\"}"; val="${val%\"}"
    fi

    [ -z "$val" ] && { echo "  skip  $key (empty)"; SEEN[$key]=1; continue; }

    SEEN[$key]=1
    push "$key" "$val"
  done < "$f"
done

echo ""
echo "Done. Verify with:  vercel env ls"

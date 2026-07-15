#!/usr/bin/env bash
# Copies production Postgres data (read-only dump) into your local dev
# database, so `npm start` locally reflects the real catalog/orders
# instead of an empty/seeded local DB.
#
# Usage:
#   PROD_DATABASE_URL='postgresql://...' npm run sync-local-db
#
# Find PROD_DATABASE_URL in the Supabase dashboard → your project →
# Settings → Database → Connection string (the "Session pooler" or
# "Transaction pooler" URI), or Vercel → ibh-project → Settings →
# Environment Variables → DATABASE_URL. Never commit it — pass it
# inline each time, it's only read from, never written to.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  # Parse just the one line we need instead of `source .env` — dotenv
  # tolerates syntax (e.g. spaces around `=`) that plain bash doesn't.
  DATABASE_URL="$(grep -m1 '^DATABASE_URL' .env | sed -E 's/^DATABASE_URL[[:space:]]*=[[:space:]]*//; s/^"(.*)"$/\1/')"
fi

if [ -z "${PROD_DATABASE_URL:-}" ]; then
  echo "PROD_DATABASE_URL is not set." >&2
  echo "Usage: PROD_DATABASE_URL='postgresql://...' npm run sync-local-db" >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL (local target, from .env) is not set." >&2
  exit 1
fi

# Safety net: refuse to run unless the local target is unmistakably local,
# so a mistyped/swapped env var can never overwrite production instead.
case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*) ;;
  *)
    echo "Refusing to run: local DATABASE_URL doesn't look local (127.0.0.1/localhost)." >&2
    echo "Got: $(echo "$DATABASE_URL" | sed -E 's#//[^@]+@#//***@#')" >&2
    exit 1
    ;;
esac

DUMP_FILE="$(mktemp /tmp/ibh-prod-dump-XXXXXX.sql)"
trap 'shred -u "$DUMP_FILE" 2>/dev/null || rm -f "$DUMP_FILE"' EXIT

echo "→ Dumping production (public schema only, read-only)…"
pg_dump "$PROD_DATABASE_URL" --schema=public --no-owner --no-privileges \
  --clean --if-exists --format=plain -f "$DUMP_FILE"

echo "→ Restoring into local database…"
psql "$DATABASE_URL" -v ON_ERROR_STOP=0 -f "$DUMP_FILE" > /dev/null

echo "✓ Local database now mirrors production."

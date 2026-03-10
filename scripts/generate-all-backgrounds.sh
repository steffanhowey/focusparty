#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# generate-all-backgrounds.sh
#
# Batch-generates AI room backgrounds for all (room × time state)
# combinations via the /api/backgrounds/generate endpoint.
#
# Usage:
#   ADMIN_SECRET=<secret> ./scripts/generate-all-backgrounds.sh [BASE_URL]
#
# Options:
#   BASE_URL    defaults to http://localhost:3000
#   ADMIN_SECRET  required — same admin secret as .env.local
#   SKIP_AFTERNOON  set to 1 to skip afternoon (already generated)
#   COUNT       candidates per combo, default 3
#   DELAY       seconds between calls, default 5
# ─────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
COUNT="${COUNT:-3}"
DELAY="${DELAY:-5}"
SKIP_AFTERNOON="${SKIP_AFTERNOON:-1}"

if [ -z "${ADMIN_SECRET:-}" ]; then
  echo "ERROR: ADMIN_SECRET env var is required"
  echo "Usage: ADMIN_SECRET=<secret> ./scripts/generate-all-backgrounds.sh [BASE_URL]"
  exit 1
fi

WORLDS=("default" "vibe-coding" "writer-room" "yc-build" "gentle-start")
TIME_STATES=("morning" "afternoon" "evening" "late_night")

TOTAL=0
SUCCESS=0
FAILED=0

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Background Generation — Batch Run"
echo "  Base URL:  $BASE_URL"
echo "  Count:     $COUNT candidates per combo"
echo "  Delay:     ${DELAY}s between calls"
echo "  Skip afternoon: $SKIP_AFTERNOON"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

for WORLD in "${WORLDS[@]}"; do
  for TIME_STATE in "${TIME_STATES[@]}"; do
    # Skip afternoon if flag is set (already generated in Phase 1)
    if [ "$SKIP_AFTERNOON" = "1" ] && [ "$TIME_STATE" = "afternoon" ]; then
      echo "⏭  Skipping $WORLD / $TIME_STATE (already generated)"
      continue
    fi

    TOTAL=$((TOTAL + 1))
    echo "┌─────────────────────────────────────────────────────"
    echo "│ [$TOTAL] Generating: $WORLD / $TIME_STATE ($COUNT candidates)"
    echo "└─────────────────────────────────────────────────────"

    HTTP_CODE=$(curl -s -o /tmp/bg-gen-response.json -w "%{http_code}" \
      -X POST "${BASE_URL}/api/backgrounds/generate" \
      -H "Authorization: Bearer ${ADMIN_SECRET}" \
      -H "Content-Type: application/json" \
      -d "{\"worldKey\":\"${WORLD}\",\"timeOfDay\":\"${TIME_STATE}\",\"count\":${COUNT}}")

    if [ "$HTTP_CODE" = "200" ]; then
      JOB_SUCCESS=$(cat /tmp/bg-gen-response.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('successCount',0))" 2>/dev/null || echo "?")
      echo "  ✓ HTTP $HTTP_CODE — $JOB_SUCCESS/$COUNT candidates succeeded"
      SUCCESS=$((SUCCESS + 1))
    else
      echo "  ✗ HTTP $HTTP_CODE — FAILED"
      cat /tmp/bg-gen-response.json 2>/dev/null || true
      FAILED=$((FAILED + 1))
    fi

    echo ""

    # Delay between calls to respect rate limits
    if [ "$TOTAL" -lt $((${#WORLDS[@]} * ${#TIME_STATES[@]})) ]; then
      echo "  ⏳ Waiting ${DELAY}s before next call..."
      sleep "$DELAY"
    fi
  done
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Done! $SUCCESS/$TOTAL groups succeeded, $FAILED failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

rm -f /tmp/bg-gen-response.json

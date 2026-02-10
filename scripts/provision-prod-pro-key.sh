#!/usr/bin/env bash
set -euo pipefail

# Provision a PRO key on production and configure domains/limits
# Requirements: curl, jq

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required (brew install jq)" >&2
  exit 1
fi

BASE_URL=${PROD_AWARDS_API_BASE:-}
ADMIN_TOKEN=${ADMIN_PROVISION_TOKEN:-}
EMAIL=${EMAIL:-}
DOMAINS_CSV=${DOMAINS:-film}
TIER=${TIER:-professional}
DAILY_LIMIT=${DAILY_LIMIT:-100000}
MONTHLY_LIMIT=${MONTHLY_LIMIT:-1000000}

if [[ -z "$BASE_URL" || -z "$ADMIN_TOKEN" || -z "$EMAIL" ]]; then
  cat >&2 <<EOF
Missing required env vars.
  PROD_AWARDS_API_BASE  e.g. https://awardsapi.example.com
  ADMIN_PROVISION_TOKEN admin token for production
  EMAIL                 recipient email for key owner

Optional overrides:
  DOMAINS               default: film (comma-separated)
  TIER                  default: professional
  DAILY_LIMIT           default: 100000
  MONTHLY_LIMIT         default: 1000000
EOF
  exit 2
fi

echo "Creating admin key for $EMAIL on $BASE_URL ..." >&2
CREATE_RES=$(curl -sS --fail -X POST "$BASE_URL/.netlify/functions/admin-create-key" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  --data-raw "{\"email\":\"$EMAIL\"}")

API_KEY=$(echo "$CREATE_RES" | jq -r '.api_key // empty')
if [[ -z "$API_KEY" ]]; then
  echo "Admin key creation did not return api_key. Response:" >&2
  echo "$CREATE_RES" >&2
  exit 3
fi

echo "Admin key created. Updating config (domains/tier/limits)..." >&2

# Convert DOMAINS CSV to JSON array
DOMAINS_JSON=$(python - <<PY
import os, json
csv = os.environ.get('DOMAINS_CSV','film')
arr = [s.strip() for s in csv.split(',') if s.strip()]
print(json.dumps(arr))
PY
)

UPDATE_BODY=$(cat <<JSON
{
  "api_key": "$API_KEY",
  "domains": $DOMAINS_JSON,
  "tier": "$TIER",
  "daily_limit": $DAILY_LIMIT,
  "monthly_limit": $MONTHLY_LIMIT
}
JSON
)

UPDATE_RES=$(curl -sS --fail -X POST "$BASE_URL/.netlify/functions/update-key-config" \
  -H "Content-Type: application/json" \
  -H "x-admin-token: $ADMIN_TOKEN" \
  --data-raw "$UPDATE_BODY")

echo "$UPDATE_RES" | jq '.'

echo "\nDone. Save this API key securely:" >&2
echo "$API_KEY" >&2

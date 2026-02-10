# Production Key Provisioning

This guide provisions a Professional-tier API key in production and configures allowed domains and usage limits.

## Prerequisites

- Deployed production AwardsAPI (Netlify)
- Admin provision token available for production
- Tools: `curl`, `jq`, and Python (for a small helper)

## One-Command Provision

Export variables and run the helper script:

```bash
export PROD_AWARDS_API_BASE="https://<YOUR_PROD_DOMAIN>"
export ADMIN_PROVISION_TOKEN="<ADMIN_PROVISION_TOKEN>"
export EMAIL="greg.robleto@creativemadness.com"   # or target owner email

# Optional overrides
export DOMAINS="film,games"   # comma-separated
export TIER="professional"
export DAILY_LIMIT=100000
export MONTHLY_LIMIT=1000000

bash scripts/provision-prod-pro-key.sh
```

The script will:

- Call `admin-create-key` to create a new key for `EMAIL`
- Call `update-key-config` to set `domains`, `tier`, and limits
- Output a JSON snapshot of the configured key and echo the plaintext API key

## Outputs

- Plaintext `api_key` is printed to stderr at the end — store this securely.
- JSON output includes current limits, tier, and allowed domains for validation.

## Troubleshooting

- 401/403: Verify `ADMIN_PROVISION_TOKEN` and that production matches `PROD_AWARDS_API_BASE`.
- Missing `api_key`: Inspect the raw response; ensure production function is deployed.
- Domain rejections when calling data endpoints: Ensure `film` is included in `DOMAINS`.

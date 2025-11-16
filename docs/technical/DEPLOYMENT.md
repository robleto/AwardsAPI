## Deployment Guide (Commercial Edition)

This document describes how to deploy the Game Awards API stack (Netlify + Neon + Stripe). It assumes basic familiarity with Node.js and Git.

### 1. Architecture Overview
Component | Purpose
--------- | -------
Netlify Functions | Public API endpoints (serverless)
Netlify Static Site | Marketing pages + docs + pricing UI
Express (local) | Convenience server for rapid dev (`server.js`)
Neon PostgreSQL | Persistent storage: users, api_keys, api_usage
Stripe | Subscription billing & webhook based key tier management
In‑Memory Dataset | Fast search over award JSON (private or sample)

### 2. Prerequisites
- Node.js 18+
- Stripe account (test + live keys)
- Neon project (serverless Postgres)
- Netlify account (site + functions)

### 3. Environment Variables (Minimum)
Variable | Description
-------- | -----------
DATABASE_URL | Neon connection string (include `sslmode=require`)
STRIPE_SECRET_KEY | Stripe secret (test or live)
STRIPE_PUBLISHABLE_KEY | Stripe publishable key
STRIPE_WEBHOOK_SECRET | From Stripe CLI or dashboard after webhook configuration
REQUIRE_API_KEY | `true` to enforce key validation
DEPLOY_ENV | `production` or `staging`

Optional:
- `API_KEY_SECRET` (future pepper for hashing)
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS` (Express only)
- `LOG_LEVEL`

### 4. Database Setup (Neon)
1. Create project in Neon.
2. Open SQL editor → run `neon/schema.sql` then `neon/subscription-schema.sql` then optionally `neon/seed.sql`.
3. Copy JDBC/psql style connection string; adapt to `postgresql://user:pass@host/db?sslmode=require`.
4. Set `DATABASE_URL` in Netlify env settings.

### 5. Stripe Setup

1. Create Products with recurring prices (monthly + annual): Games API (Starter/Pro), Film API (Starter/Pro), Bundle (Starter/Pro). See `docs/technical/STRIPE-SETUP.md` for exact mapping.

2. Capture resulting price IDs → map to env vars:
	- Games: `STRIPE_PRICE_GAMES_STARTER_MONTHLY`, `STRIPE_PRICE_GAMES_STARTER_ANNUAL`, `STRIPE_PRICE_GAMES_PRO_MONTHLY`, `STRIPE_PRICE_GAMES_PRO_ANNUAL`
	- Film: `STRIPE_PRICE_FILM_STARTER_MONTHLY`, `STRIPE_PRICE_FILM_STARTER_ANNUAL`, `STRIPE_PRICE_FILM_PRO_MONTHLY`, `STRIPE_PRICE_FILM_PRO_ANNUAL`
	- Bundle: `STRIPE_PRICE_BUNDLE_STARTER_MONTHLY`, `STRIPE_PRICE_BUNDLE_STARTER_ANNUAL`, `STRIPE_PRICE_BUNDLE_PRO_MONTHLY`, `STRIPE_PRICE_BUNDLE_PRO_ANNUAL`

3. Add a webhook endpoint (Netlify function URL `/.netlify/functions/webhook-stripe`) listening for:
	- `customer.subscription.updated`
	- `customer.subscription.deleted`
	- `invoice.payment_failed`
	- `invoice.payment_succeeded`
4. Store the webhook signing secret as `STRIPE_WEBHOOK_SECRET`.

### 6. Netlify Configuration

Netlify UI → Site Settings:

- Build command: `npm run build`
- Publish directory: `public`
- Functions directory: `netlify/functions`
- Environment variables: add all required keys

### 7. Local Development

```bash
cp .env.example .env   # populate values
npm install
netlify dev            # spins functions + static + proxy
# or
npm run dev            # Express only (no serverless simulation)
```

### 8. Award Dataset

Public repo includes `data/sample-awards.json` (subset). Place full licensed dataset at `internal/enhanced-honors-complete.json` (gitignored) to enable full results locally / production. Loader auto‑detects.

### 9. Subscription Flow

1. Front-end calls `/.netlify/functions/create-subscription-new` with email, name, plan or priceId (see plan keys in `STRIPE-SETUP.md`).
2. Function creates (or reuses) Stripe customer + subscription (incomplete) → returns `client_secret` + provisional API key with plan limits.
3. Stripe finalizes payment → webhook adjusts/suspends/resumes limits.

### 10. Rate Limiting & Validation

- PL/pgSQL `validate_api_key_enhanced` enforces daily + monthly limits, suspension, resets.
- Response headers include remaining daily & monthly usage.

### 11. Logging & Observability

- Usage logged to `api_usage` (basic fields). Extend schema for latency / user agent detail as needed.
- Health endpoint: `/.netlify/functions/health` includes build info (if generated) + DB check.

### 12. Deploy Steps Recap

```bash
# First time
psql "$DATABASE_URL" -f neon/schema.sql
psql "$DATABASE_URL" -f neon/subscription-schema.sql
psql "$DATABASE_URL" -f neon/seed.sql  # optional

# Build & deploy
npm install
npm run build
git add . && git commit -m "deploy: production release" && git push
# Netlify triggers build
```

### 13. Hardening Suggestions

- Add WAF / custom domain (Netlify)
- Implement IP throttling via external gateway if exceeding function rate possibilities
- Add encrypted hashing with pepper for API keys
- Introduce signed usage logs to prevent tampering
- Monitor Stripe webhook delivery (retry logic handled by Stripe)

### 14. Versioning & Releases

- Track version in `VERSION`
- Update `CHANGELOG.md` with user‑visible changes

### 15. Disaster Recovery

- Backup Neon (point-in-time via Neon branching)
- Export dataset occasionally if mutated (currently read-only dataset)

End of Deployment Guide.

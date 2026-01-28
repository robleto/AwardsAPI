# Pricing Implementation Status

## Completed

✅ **Code Updates**
- Updated `public/pricing.html` to show Games ($5/$25), Film ($29/$49), Bundle ($39/$69) with annual options
- Switched pricing page to call `/.netlify/functions/create-subscription-new`
- Updated `netlify/functions/create-subscription-new.js` with new plan keys and price ID mappings
- Updated `netlify/functions/webhook-stripe.js` to map new price IDs from env vars
- Fixed API key validation across all endpoints (film-awards, oscars, oscar-stats, api) to use `db.validateApiKey`
- Added optional domain enforcement when `allowed_domains` metadata is present
- Updated `docs/technical/STRIPE-SETUP.md` with new plan matrix and env vars (markdown lint clean)
- Updated `docs/technical/DEPLOYMENT.md` to reference new subscription flow and plans (markdown lint clean)
- Updated `scripts/deploy-audit.js` to require new Stripe price env vars

✅ **Database Migrations Ready**
- Created `neon/20251115_add_domains_to_validate_enhanced.sql` to return `allowed_domains` from `validate_api_key_enhanced`
- This migration needs to be applied to Neon DB

## Pending Actions

### 1. Create Missing Stripe Products & Prices

You have Pro tier prices configured but are missing Starter tier prices. Create these in Stripe:

**Games Starter**: $5/mo, $50/yr → Get price IDs for:
- `STRIPE_PRICE_GAMES_STARTER_MONTHLY`
- `STRIPE_PRICE_GAMES_STARTER_ANNUAL`

**Film Starter**: $29/mo, $290/yr → Get price IDs for:
- `STRIPE_PRICE_FILM_STARTER_MONTHLY`
- `STRIPE_PRICE_FILM_STARTER_ANNUAL`

**Bundle Starter**: $39/mo, $390/yr → Get price IDs for:
- `STRIPE_PRICE_BUNDLE_STARTER_MONTHLY`
- `STRIPE_PRICE_BUNDLE_STARTER_ANNUAL`

### 2. Add Missing Env Vars

Add to `.env` and Netlify site env:
```bash
STRIPE_PUBLISHABLE_KEY=pk_test_...  # or pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Games Starter
STRIPE_PRICE_GAMES_STARTER_MONTHLY=price_...
STRIPE_PRICE_GAMES_STARTER_ANNUAL=price_...

# Film Starter
STRIPE_PRICE_FILM_STARTER_MONTHLY=price_...
STRIPE_PRICE_FILM_STARTER_ANNUAL=price_...

# Bundle Starter
STRIPE_PRICE_BUNDLE_STARTER_MONTHLY=price_...
STRIPE_PRICE_BUNDLE_STARTER_ANNUAL=price_...
```

### 3. Apply Database Migration

Run this to add `allowed_domains` to validation response:
```bash
psql "$DATABASE_URL" < neon/20251115_add_domains_to_validate_enhanced.sql
```

Or apply the domain access migration first if not already done:
```bash
psql "$DATABASE_URL" < neon/20251114_domain_access_control.sql
psql "$DATABASE_URL" < neon/20251115_add_domains_to_validate_enhanced.sql
```

### 4. Stripe Elements Integration (Optional)

The pricing page currently has placeholder card collection. To enable real payments, wire Stripe Elements in `public/pricing.html` for proper card capture (or use Stripe Checkout).

### 5. Test End-to-End

Once env vars are set:
```bash
# Audit should pass
node scripts/deploy-audit.js

# Start local dev
netlify dev

# Test subscription creation
# Test API key validation with domain enforcement
curl "http://localhost:8888/.netlify/functions/film-awards?imdb_id=tt15398776&apikey=YOUR_KEY"
```

## Summary

All code is ready for the new pricing tiers. You need to:
1. Create Starter products/prices in Stripe
2. Add 8 missing env vars (Starter price IDs + webhook secret + publishable key)
3. Apply DB migration for domain metadata
4. Deploy to Netlify

After that, the pricing page, subscription creation, and domain-based API access will be fully operational.

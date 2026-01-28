# Stripe Setup

## 1. Products & Prices

Create the following Products with Monthly and Annual recurring Prices:

- Games API
  - Starter ($5/mo, ~$50/yr): `STRIPE_PRICE_GAMES_STARTER_MONTHLY`, `STRIPE_PRICE_GAMES_STARTER_ANNUAL`
  - Pro ($25/mo, ~$250/yr): `STRIPE_PRICE_GAMES_PRO_MONTHLY`, `STRIPE_PRICE_GAMES_PRO_ANNUAL`
- Film API
  - Starter ($29/mo, ~$290/yr): `STRIPE_PRICE_FILM_STARTER_MONTHLY`, `STRIPE_PRICE_FILM_STARTER_ANNUAL`
  - Pro ($49/mo, ~$490/yr): `STRIPE_PRICE_FILM_PRO_MONTHLY`, `STRIPE_PRICE_FILM_PRO_ANNUAL`
- Bundle (Games + Film)
  - Starter ($39/mo, ~$390/yr): `STRIPE_PRICE_BUNDLE_STARTER_MONTHLY`, `STRIPE_PRICE_BUNDLE_STARTER_ANNUAL`
  - Pro ($69/mo, ~$690/yr): `STRIPE_PRICE_BUNDLE_PRO_MONTHLY`, `STRIPE_PRICE_BUNDLE_PRO_ANNUAL`

Name your prices clearly (e.g., "Games Starter Monthly") so they’re easy to map.

## 2. Environment Variables

Set:
 
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Games
STRIPE_PRICE_GAMES_STARTER_MONTHLY=price_...
STRIPE_PRICE_GAMES_STARTER_ANNUAL=price_...
STRIPE_PRICE_GAMES_PRO_MONTHLY=price_...
STRIPE_PRICE_GAMES_PRO_ANNUAL=price_...

# Film
STRIPE_PRICE_FILM_STARTER_MONTHLY=price_...
STRIPE_PRICE_FILM_STARTER_ANNUAL=price_...
STRIPE_PRICE_FILM_PRO_MONTHLY=price_...
STRIPE_PRICE_FILM_PRO_ANNUAL=price_...

# Bundle
STRIPE_PRICE_BUNDLE_STARTER_MONTHLY=price_...
STRIPE_PRICE_BUNDLE_STARTER_ANNUAL=price_...
STRIPE_PRICE_BUNDLE_PRO_MONTHLY=price_...
STRIPE_PRICE_BUNDLE_PRO_ANNUAL=price_...
```

## 3. Webhook

Endpoint URL: `https://<your-domain>/.netlify/functions/webhook-stripe`
Events: subscription updated/deleted, invoice payment failed/succeeded.
Store signing secret as `STRIPE_WEBHOOK_SECRET`.

## 4. Subscription Creation Flow

Front-end invokes `/.netlify/functions/create-subscription-new` with `{ email, name, plan }` or `{ priceId }`.

Valid `plan` keys:

```text
# Games
games_starter_monthly | games_starter_annual
games_pro_monthly     | games_pro_annual

# Film
film_starter_monthly  | film_starter_annual
film_pro_monthly      | film_pro_annual

# Bundle
bundle_starter_monthly | bundle_starter_annual
bundle_pro_monthly     | bundle_pro_annual
```

The function maps plan → Stripe Price ID → creates Stripe Customer + Subscription → generates API Key → applies limits.

## 5. Tier Mapping & Limits

Plan Key → Limits: defined in `netlify/functions/create-subscription-new.js` (`PLAN_CONFIG`). Defaults:

- Games Starter: 10k/mo, 1k/day
- Games Pro: 250k/mo, 25k/day
- Film Starter: 50k/mo, 5k/day
- Film Pro: 500k/mo, 50k/day
- Bundle Starter: 60k/mo, 6k/day
- Bundle Pro: 700k/mo, 70k/day

The `tier` string (e.g., `games_starter`, `film_pro`, `bundle_pro`) and `domains` (games/film) are stored as metadata.

## 6. Testing

Use test cards (4242 4242 4242 4242). Simulate failure by using incomplete card or test failure numbers.


End.

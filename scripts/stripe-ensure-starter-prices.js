#!/usr/bin/env node
/*
 Ensures Starter prices exist for Games, Film, and Bundle products.
 - Dry run by default: reports existing/missing and prints .env lines
 - Use --apply to create any missing prices

 Requires: STRIPE_SECRET_KEY in environment
*/

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const PLANS = [
  {
    productName: 'Board Games API',
    domain: 'games',
    prices: [
      { key: 'STRIPE_PRICE_GAMES_STARTER_MONTHLY', lookup: 'games_starter_monthly', nickname: 'Games Starter Monthly', interval: 'month', amount: 500 },
      { key: 'STRIPE_PRICE_GAMES_STARTER_ANNUAL',  lookup: 'games_starter_annual',  nickname: 'Games Starter Annual',  interval: 'year',  amount: 2500 }
    ]
  },
  {
    productName: 'Film Awards API',
    domain: 'film',
    prices: [
      { key: 'STRIPE_PRICE_FILM_STARTER_MONTHLY', lookup: 'film_starter_monthly', nickname: 'Film Starter Monthly', interval: 'month', amount: 2900 },
      { key: 'STRIPE_PRICE_FILM_STARTER_ANNUAL',  lookup: 'film_starter_annual',  nickname: 'Film Starter Annual',  interval: 'year',  amount: 4900 }
    ]
  },
  {
    productName: 'API Bundle',
    domain: 'bundle',
    prices: [
      { key: 'STRIPE_PRICE_BUNDLE_STARTER_MONTHLY', lookup: 'bundle_starter_monthly', nickname: 'Bundle Starter Monthly', interval: 'month', amount: 3900 },
      { key: 'STRIPE_PRICE_BUNDLE_STARTER_ANNUAL',  lookup: 'bundle_starter_annual',  nickname: 'Bundle Starter Annual',  interval: 'year',  amount: 6900 }
    ]
  }
];

(async () => {
  try {
    assert(process.env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY is required');
    const apply = process.argv.includes('--apply');

    const outEnv = [];

    for (const plan of PLANS) {
      // Find product by name
      const prods = await stripe.products.list({ limit: 100, active: true });
      const product = prods.data.find(p => p.name === plan.productName);
      if (!product) {
        console.error(`✖ Product not found: ${plan.productName}`);
        continue;
      }

      // List existing prices for the product
      const existing = await stripe.prices.list({ product: product.id, active: true, limit: 100 });

      for (const spec of plan.prices) {
        // Try match by lookup_key first, then by interval+amount
        let match = existing.data.find(pr => pr.lookup_key === spec.lookup);
        if (!match) {
          match = existing.data.find(pr => pr.recurring?.interval === spec.interval && pr.unit_amount === spec.amount && pr.currency === 'usd');
        }

        if (match) {
          console.log(`✔ ${plan.productName} ${spec.nickname}: ${match.id}`);
          outEnv.push(`${spec.key}=${match.id}`);
          continue;
        }

        console.log(`… Missing ${plan.productName} ${spec.nickname}`);
        if (!apply) {
          outEnv.push(`${spec.key}=`);
          continue;
        }

        // Create the missing price
        const created = await stripe.prices.create({
          product: product.id,
          currency: 'usd',
          unit_amount: spec.amount,
          nickname: spec.nickname,
          lookup_key: spec.lookup,
          recurring: { interval: spec.interval },
          metadata: { tier: 'starter', domain: plan.domain, plan_key: spec.lookup }
        });
        console.log(`➕ Created ${plan.productName} ${spec.nickname}: ${created.id}`);
        outEnv.push(`${spec.key}=${created.id}`);
      }
    }

    console.log('\n# Copy into .env');
    outEnv.forEach(l => console.log(l));
    console.log('\nDone.');
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();

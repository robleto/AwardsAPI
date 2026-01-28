#!/usr/bin/env node
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

(async () => {
  const products = await stripe.products.list({ active: true, limit: 100 });
  
  const filmProd = products.data.find(p => p.name === 'Film Awards API');
  const bundleProd = products.data.find(p => p.name === 'API Bundle');
  
  console.log('Creating Film Starter Monthly ($29/mo)...');
  const filmStarter = await stripe.prices.create({
    product: filmProd.id,
    currency: 'usd',
    unit_amount: 2900,
    nickname: 'Film Starter Monthly',
    lookup_key: 'film_starter_monthly',
    recurring: { interval: 'month' },
    metadata: { tier: 'starter', domain: 'film', plan_key: 'film_starter_monthly' }
  });
  console.log(`✔ Created: ${filmStarter.id}`);
  
  console.log('\nCreating Bundle Starter Monthly ($39/mo)...');
  const bundleStarter = await stripe.prices.create({
    product: bundleProd.id,
    currency: 'usd',
    unit_amount: 3900,
    nickname: 'Bundle Starter Monthly',
    lookup_key: 'bundle_starter_monthly',
    recurring: { interval: 'month' },
    metadata: { tier: 'starter', domain: 'bundle', plan_key: 'bundle_starter_monthly' }
  });
  console.log(`✔ Created: ${bundleStarter.id}`);
  
  console.log('\n# Add to .env:');
  console.log(`STRIPE_PRICE_FILM_STARTER_MONTHLY=${filmStarter.id}`);
  console.log(`STRIPE_PRICE_BUNDLE_STARTER_MONTHLY=${bundleStarter.id}`);
})();

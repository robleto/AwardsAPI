#!/usr/bin/env node
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || '');

(async () => {
  const products = await stripe.products.list({ active: true, limit: 100 });
  
  for (const prod of products.data) {
    console.log(`\n${prod.name} (${prod.id})`);
    const prices = await stripe.prices.list({ product: prod.id, active: true, limit: 100 });
    prices.data.forEach(p => {
      const amt = (p.unit_amount / 100).toFixed(2);
      const int = p.recurring?.interval || 'one-time';
      console.log(`  ${p.id} - $${amt} ${int} - ${p.nickname || '(no nickname)'}`);
    });
  }
})();

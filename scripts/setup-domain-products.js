#!/usr/bin/env node

/**
 * Setup Domain-Based Stripe Products
 * 
 * Creates products and prices for Option B: Domain-Specific Tiers
 * - Games Free (free tier)
 * - Games Pro ($29/mo)
 * - Film Free (free tier) 
 * - Film Pro ($29/mo)
 * - Bundle Pro ($49/mo - access to both domains)
 * 
 * Usage: node scripts/setup-domain-products.js
 */

require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PRODUCTS = [
  {
    name: 'Board Games Free',
    description: 'Free tier access to board game awards data',
    metadata: {
      tier: 'free',
      domain: 'games',
      daily_limit: '1000',
      monthly_limit: '30000',
      allowed_domains: 'games'
    },
    prices: [] // Free tier has no Stripe price
  },
  {
    name: 'Board Games Pro',
    description: 'Professional access to board game awards data',
    metadata: {
      tier: 'professional',
      domain: 'games',
      daily_limit: '10000',
      monthly_limit: '300000',
      allowed_domains: 'games'
    },
    prices: [
      { amount: 2900, interval: 'month', nickname: 'Monthly' },
      { amount: 29000, interval: 'year', nickname: 'Annual (Save 17%)' }
    ]
  },
  {
    name: 'Film Awards Free',
    description: 'Free tier access to film awards data',
    metadata: {
      tier: 'free',
      domain: 'film',
      daily_limit: '1000',
      monthly_limit: '30000',
      allowed_domains: 'film'
    },
    prices: []
  },
  {
    name: 'Film Awards Pro',
    description: 'Professional access to film awards data',
    metadata: {
      tier: 'professional',
      domain: 'film',
      daily_limit: '10000',
      monthly_limit: '300000',
      allowed_domains: 'film'
    },
    prices: [
      { amount: 2900, interval: 'month', nickname: 'Monthly' },
      { amount: 29000, interval: 'year', nickname: 'Annual (Save 17%)' }
    ]
  },
  {
    name: 'Bundle Pro',
    description: 'Professional access to both board game and film awards data',
    metadata: {
      tier: 'professional',
      domain: 'bundle',
      daily_limit: '10000',
      monthly_limit: '300000',
      allowed_domains: 'games,film'
    },
    prices: [
      { amount: 4900, interval: 'month', nickname: 'Monthly' },
      { amount: 49000, interval: 'year', nickname: 'Annual (Save 17%)' }
    ]
  }
];

async function setupProducts() {
  console.log('🎬 Setting up domain-based Stripe products...\n');

  const results = {
    products: [],
    prices: []
  };

  for (const productConfig of PRODUCTS) {
    try {
      console.log(`Creating product: ${productConfig.name}`);
      
      // Create product
      const product = await stripe.products.create({
        name: productConfig.name,
        description: productConfig.description,
        metadata: productConfig.metadata
      });

      console.log(`✅ Product created: ${product.id}`);
      results.products.push({
        name: product.name,
        id: product.id,
        domain: productConfig.metadata.domain,
        tier: productConfig.metadata.tier
      });

      // Create prices for this product
      for (const priceConfig of productConfig.prices) {
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceConfig.amount,
          currency: 'usd',
          recurring: {
            interval: priceConfig.interval
          },
          nickname: priceConfig.nickname,
          metadata: {
            domain: productConfig.metadata.domain,
            tier: productConfig.metadata.tier
          }
        });

        console.log(`  ✅ Price created: ${price.id} (${priceConfig.nickname})`);
        results.prices.push({
          product_name: product.name,
          price_id: price.id,
          amount: priceConfig.amount / 100,
          interval: priceConfig.interval,
          nickname: priceConfig.nickname
        });
      }

      console.log('');
    } catch (error) {
      console.error(`❌ Error creating ${productConfig.name}:`, error.message);
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 SETUP SUMMARY');
  console.log('='.repeat(80));
  console.log('\nProducts Created:');
  console.log('─'.repeat(80));
  results.products.forEach(p => {
    console.log(`${p.name.padEnd(30)} | ${p.id} | ${p.domain}/${p.tier}`);
  });

  console.log('\n\nPrices Created:');
  console.log('─'.repeat(80));
  results.prices.forEach(p => {
    console.log(`${p.product_name.padEnd(30)} | ${p.price_id}`);
    console.log(`  $${p.amount}/${p.interval} - ${p.nickname}`);
  });

  // Generate environment variable suggestions
  console.log('\n\n📝 Environment Variables:');
  console.log('─'.repeat(80));
  console.log('Add these to your .env and Netlify environment:\n');
  
  const gamesPro = results.prices.find(p => p.product_name === 'Board Games Pro' && p.interval === 'month');
  const gamesProAnnual = results.prices.find(p => p.product_name === 'Board Games Pro' && p.interval === 'year');
  const filmPro = results.prices.find(p => p.product_name === 'Film Awards Pro' && p.interval === 'month');
  const filmProAnnual = results.prices.find(p => p.product_name === 'Film Awards Pro' && p.interval === 'year');
  const bundlePro = results.prices.find(p => p.product_name === 'Bundle Pro' && p.interval === 'month');
  const bundleProAnnual = results.prices.find(p => p.product_name === 'Bundle Pro' && p.interval === 'year');

  console.log(`# Board Games Pricing`);
  if (gamesPro) console.log(`STRIPE_PRICE_GAMES_PRO_MONTHLY=${gamesPro.price_id}`);
  if (gamesProAnnual) console.log(`STRIPE_PRICE_GAMES_PRO_ANNUAL=${gamesProAnnual.price_id}`);
  
  console.log(`\n# Film Awards Pricing`);
  if (filmPro) console.log(`STRIPE_PRICE_FILM_PRO_MONTHLY=${filmPro.price_id}`);
  if (filmProAnnual) console.log(`STRIPE_PRICE_FILM_PRO_ANNUAL=${filmProAnnual.price_id}`);
  
  console.log(`\n# Bundle Pricing`);
  if (bundlePro) console.log(`STRIPE_PRICE_BUNDLE_PRO_MONTHLY=${bundlePro.price_id}`);
  if (bundleProAnnual) console.log(`STRIPE_PRICE_BUNDLE_PRO_ANNUAL=${bundleProAnnual.price_id}`);

  console.log('\n' + '='.repeat(80));
  console.log('✅ Setup complete!');
  console.log('='.repeat(80) + '\n');
}

// Run setup
setupProducts().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

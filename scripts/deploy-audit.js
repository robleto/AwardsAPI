#!/usr/bin/env node
/*
 Deployment readiness audit.
 Checks: required env vars, Stripe keys format, Neon connectivity, build-info, Stripe price IDs, webhook secret, function presence.
*/
const fs = require('fs');
const path = require('path');
require('dotenv').config();
let chalk;
try {
  chalk = require('chalk');
} catch(e) {
  // Fallback if chalk not available
  chalk = { green: (s) => `✔ ${s}`, red: (s) => `✖ ${s}`, gray: (s) => s };
}
let stripe = null;
try { stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || ''); } catch(_) {}
const db = require('../config/database');

const REQUIRED_ENV = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  // Games
  'STRIPE_PRICE_GAMES_STARTER_MONTHLY',
  'STRIPE_PRICE_GAMES_STARTER_ANNUAL',
  'STRIPE_PRICE_GAMES_PRO_MONTHLY',
  'STRIPE_PRICE_GAMES_PRO_ANNUAL',
  // Film
  'STRIPE_PRICE_FILM_STARTER_MONTHLY',
  'STRIPE_PRICE_FILM_STARTER_ANNUAL',
  'STRIPE_PRICE_FILM_PRO_MONTHLY',
  'STRIPE_PRICE_FILM_PRO_ANNUAL',
  // Bundle
  'STRIPE_PRICE_BUNDLE_STARTER_MONTHLY',
  'STRIPE_PRICE_BUNDLE_STARTER_ANNUAL',
  'STRIPE_PRICE_BUNDLE_PRO_MONTHLY',
  'STRIPE_PRICE_BUNDLE_PRO_ANNUAL',
  'STRIPE_WEBHOOK_SECRET'
];

(async () => {
  const results = [];
  function pass(msg, extra={}) { results.push({ok:true,msg,extra}); }
  function fail(msg, extra={}) { results.push({ok:false,msg,extra}); }

  // Env vars
  for (const v of REQUIRED_ENV) {
    if (process.env[v]) pass(`ENV ${v} set`); else fail(`ENV ${v} missing`);
  }

  // Stripe key formats
  if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) pass('Stripe secret key format valid'); else fail('Stripe secret key format invalid');
  if (process.env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_test_') || process.env.STRIPE_PUBLISHABLE_KEY?.startsWith('pk_live_')) pass('Stripe publishable key format valid'); else fail('Stripe publishable key format invalid');

  // Price id sanity (simple prefix check)
  const PRICE_KEYS = [
    // Games
    'STRIPE_PRICE_GAMES_STARTER_MONTHLY','STRIPE_PRICE_GAMES_STARTER_ANNUAL',
    'STRIPE_PRICE_GAMES_PRO_MONTHLY','STRIPE_PRICE_GAMES_PRO_ANNUAL',
    // Film
    'STRIPE_PRICE_FILM_STARTER_MONTHLY','STRIPE_PRICE_FILM_STARTER_ANNUAL',
    'STRIPE_PRICE_FILM_PRO_MONTHLY','STRIPE_PRICE_FILM_PRO_ANNUAL',
    // Bundle
    'STRIPE_PRICE_BUNDLE_STARTER_MONTHLY','STRIPE_PRICE_BUNDLE_STARTER_ANNUAL',
    'STRIPE_PRICE_BUNDLE_PRO_MONTHLY','STRIPE_PRICE_BUNDLE_PRO_ANNUAL'
  ];
  PRICE_KEYS.forEach(k=>{
    if (process.env[k]?.startsWith('price_')) pass(`${k} looks like a Stripe price id`); else fail(`${k} not a valid price id`);
  });
  // Deprecated (optional): warn if old envs still present
  ['STRIPE_PRICE_PROFESSIONAL_MONTHLY','STRIPE_PRICE_PROFESSIONAL_ANNUAL','STRIPE_PRICE_ENTERPRISE_MONTHLY','STRIPE_PRICE_ENTERPRISE_ANNUAL'].forEach(k=>{
    if (process.env[k]) pass(`${k} present (deprecated)`);
  });

  // Webhook secret format
  if (/^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET||'')) pass('Webhook secret format valid'); else fail('Webhook secret format invalid');

  // Build info
  const buildInfoPath = path.join(__dirname,'..','build-info.json');
  if (fs.existsSync(buildInfoPath)) {
    try { const info = JSON.parse(fs.readFileSync(buildInfoPath,'utf8')); pass('build-info.json present', {commit: info.commit?.slice(0,7)}); }
    catch(e){ fail('build-info.json unreadable'); }
  } else {
    fail('build-info.json missing (run npm run build:meta)');
  }

  // Neon connectivity
  try {
    const hc = await db.healthCheck();
    if (hc?.status==='healthy') pass('Neon DB connection healthy'); else fail('Neon DB health unexpected', hc);
  } catch(e) { fail('Neon DB connection failed', {error: e.message}); }

  // Stripe API quick probe (products list limited)
  if (stripe) {
    try {
      await stripe.products.list({limit:1});
      pass('Stripe API reachable');
    } catch(e) {
      fail('Stripe API not reachable', {error:e.message});
    }
  }

  // Functions existence
  const fnDir = path.join(__dirname,'..','netlify','functions');
  const requiredFns = ['api.js','health.js','create-subscription-new.js','webhook-stripe.js','generate-key.js'];
  requiredFns.forEach(f=>{
    if (fs.existsSync(path.join(fnDir,f))) pass(`Function ${f} present`); else fail(`Function ${f} missing`);
  });

  // Summary
  const okCount = results.filter(r=>r.ok).length;
  const failCount = results.length - okCount;
  console.log('\nDeployment Audit Summary');
  results.forEach(r=>{
    const symbol = r.ok ? '✔' : '✖';
    const line = `${symbol} ${r.msg}` + (r.extra && Object.keys(r.extra).length ? ` ${JSON.stringify(r.extra)}` : '');
    console.log(line);
  });
  console.log(`\n${okCount} passed, ${failCount} failed`);
  process.exit(failCount ? 1 : 0);
})();

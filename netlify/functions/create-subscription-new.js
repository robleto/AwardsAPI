const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../../config/database');

// Price ID mapping from environment variables
// Games
// Starter $5 / Pro $25
// Film
// Starter $29 / Pro $49
// Bundle (Games+Film)
// Starter $39 / Pro $69
const STRIPE_PRICES = {
  // Games
  games_starter_monthly: process.env.STRIPE_PRICE_GAMES_STARTER_MONTHLY,
  games_starter_annual: process.env.STRIPE_PRICE_GAMES_STARTER_ANNUAL,
  games_pro_monthly: process.env.STRIPE_PRICE_GAMES_PRO_MONTHLY,
  games_pro_annual: process.env.STRIPE_PRICE_GAMES_PRO_ANNUAL,
  // Film
  film_starter_monthly: process.env.STRIPE_PRICE_FILM_STARTER_MONTHLY,
  film_starter_annual: process.env.STRIPE_PRICE_FILM_STARTER_ANNUAL,
  film_pro_monthly: process.env.STRIPE_PRICE_FILM_PRO_MONTHLY,
  film_pro_annual: process.env.STRIPE_PRICE_FILM_PRO_ANNUAL,
  // Bundle
  bundle_starter_monthly: process.env.STRIPE_PRICE_BUNDLE_STARTER_MONTHLY,
  bundle_starter_annual: process.env.STRIPE_PRICE_BUNDLE_STARTER_ANNUAL,
  bundle_pro_monthly: process.env.STRIPE_PRICE_BUNDLE_PRO_MONTHLY,
  bundle_pro_annual: process.env.STRIPE_PRICE_BUNDLE_PRO_ANNUAL
};

// Plan configuration (limits + domain access)
// Suggested defaults:
// Games Starter: 10k/mo, 1k/day | Games Pro: 250k/mo, 25k/day
// Film Starter: 50k/mo, 5k/day | Film Pro: 500k/mo, 50k/day
// Bundle Starter: 60k/mo, 6k/day | Bundle Pro: 700k/mo, 70k/day
const PLAN_CONFIG = {
  // Games
  games_starter_monthly: { tier: 'games_starter', domains: ['games'], daily_limit: 1000, monthly_limit: 10000 },
  games_starter_annual: { tier: 'games_starter', domains: ['games'], daily_limit: 1000, monthly_limit: 10000 },
  games_pro_monthly: { tier: 'games_pro', domains: ['games'], daily_limit: 25000, monthly_limit: 250000 },
  games_pro_annual: { tier: 'games_pro', domains: ['games'], daily_limit: 25000, monthly_limit: 250000 },
  // Film
  film_starter_monthly: { tier: 'film_starter', domains: ['film'], daily_limit: 5000, monthly_limit: 50000 },
  film_starter_annual: { tier: 'film_starter', domains: ['film'], daily_limit: 5000, monthly_limit: 50000 },
  film_pro_monthly: { tier: 'film_pro', domains: ['film'], daily_limit: 50000, monthly_limit: 500000 },
  film_pro_annual: { tier: 'film_pro', domains: ['film'], daily_limit: 50000, monthly_limit: 500000 },
  // Bundle
  bundle_starter_monthly: { tier: 'bundle_starter', domains: ['games', 'film'], daily_limit: 6000, monthly_limit: 60000 },
  bundle_starter_annual: { tier: 'bundle_starter', domains: ['games', 'film'], daily_limit: 6000, monthly_limit: 60000 },
  bundle_pro_monthly: { tier: 'bundle_pro', domains: ['games', 'film'], daily_limit: 70000, monthly_limit: 700000 },
  bundle_pro_annual: { tier: 'bundle_pro', domains: ['games', 'film'], daily_limit: 70000, monthly_limit: 700000 }
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }) 
    };
  }

  try {
    const { email, name, plan, priceId } = JSON.parse(event.body);

    // Validate required fields
    if (!email || !name) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Email and name are required' })
      };
    }

    // Determine which price ID to use (priceId takes precedence over plan)
    let selectedPriceId = priceId;
    let planConfig;

    if (priceId) {
      // Find plan config by price ID
      const planKey = Object.keys(STRIPE_PRICES).find(key => STRIPE_PRICES[key] === priceId);
      planConfig = planKey ? PLAN_CONFIG[planKey] : null;
    } else if (plan) {
      // Use plan name to get price ID and config
      selectedPriceId = STRIPE_PRICES[plan];
      planConfig = PLAN_CONFIG[plan];
    }

    if (!selectedPriceId || !planConfig) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid plan or price ID', 
          available_plans: Object.keys(PLAN_CONFIG) 
        })
      };
    }

    console.log(`Creating subscription for ${email} with plan ${plan} (${planConfig.tier})`);

    // Create or get customer
    let customer;
    const existingCustomers = await stripe.customers.list({ email, limit: 1 });
    
    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
      console.log(`Found existing customer: ${customer.id}`);
    } else {
      customer = await stripe.customers.create({
        email,
        name,
        metadata: { 
          source: 'game_awards_api',
          tier: planConfig.tier,
          domains: (planConfig.domains || []).join(',')
        }
      });
      console.log(`Created new customer: ${customer.id}`);
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: selectedPriceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        tier: planConfig.tier,
        domains: (planConfig.domains || []).join(','),
        daily_limit: planConfig.daily_limit.toString(),
        monthly_limit: planConfig.monthly_limit.toString()
      }
    });

    console.log(`Created subscription: ${subscription.id}`);

    // Generate API key
    const keyResult = await db.generateApiKey(
      email,
      null,
      null,
      'Stripe subscription',
      'Tier: ' + planConfig.tier
    );

    if (!keyResult || !keyResult.success) {
      throw new Error('Failed to generate API key: ' + (keyResult?.error || 'Unknown error'));
    }

    const apiKey = keyResult.api_key;

    // Apply tier & stripe linkage
    await db.updateApiKeyLimits(apiKey, {
      tier: planConfig.tier,
      daily_limit: planConfig.daily_limit,
      monthly_limit: planConfig.monthly_limit,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id
    });

    console.log(`Generated API key & applied limits for ${email}`);

    // Return subscription details
    const result = {
      success: true,
      subscription_id: subscription.id,
      customer_id: customer.id,
      client_secret: subscription.latest_invoice.payment_intent.client_secret,
      api_key: apiKey,
      plan: planConfig.tier,
      domains: planConfig.domains,
      daily_limit: planConfig.daily_limit,
      monthly_limit: planConfig.monthly_limit,
      price_id: selectedPriceId
    };

    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify(result) 
    };

  } catch (error) {
    console.error('Subscription creation error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Failed to create subscription',
        message: error.message
      })
    };
  }
};

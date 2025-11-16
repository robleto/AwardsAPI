// netlify/functions/webhook-stripe.js
// Stripe webhook handler for subscription events

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../../config/database');

exports.handler = async (event, context) => {
  const sig = event.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Webhook signature verification failed' })
    };
  }

  try {
    switch (stripeEvent.type) {
      case 'customer.subscription.deleted':
        // Downgrade to free tier
        await handleSubscriptionCancelled(stripeEvent.data.object);
        break;
        
      case 'customer.subscription.updated':
        // Update subscription details
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
        
      case 'invoice.payment_failed':
        // Suspend API access
        await handlePaymentFailed(stripeEvent.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        // Restore API access and reset limits
        await handlePaymentSucceeded(stripeEvent.data.object);
        break;
        
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};

async function handleSubscriptionCancelled(subscription) {
  // Find API keys for this customer and downgrade to free
  await db.updateApiKeysByStripeCustomer(subscription.customer, {
    tier: 'free',
    daily_limit: 1000,
    monthly_limit: 1000,
    stripe_subscription_id: null
  });
}

async function handleSubscriptionUpdated(subscription) {
  // Update API key limits based on new subscription
  const planLimits = getPlanLimits(subscription.items.data[0].price.id);
  await db.updateApiKeysByStripeCustomer(subscription.customer, planLimits);
}

async function handlePaymentFailed(invoice) {
  // Suspend API access
  await db.suspendApiKeysByStripeCustomer(invoice.customer);
}

async function handlePaymentSucceeded(invoice) {
  // Restore API access and reset monthly limits
  await db.restoreApiKeysByStripeCustomer(invoice.customer);
}

function getPlanLimits(priceId) {
  // Map Stripe Price IDs (from env) to tiers and limits
  const planMap = {
    // Games
    [process.env.STRIPE_PRICE_GAMES_STARTER_MONTHLY]: { tier: 'games_starter', daily_limit: 1000, monthly_limit: 10000 },
    [process.env.STRIPE_PRICE_GAMES_STARTER_ANNUAL]: { tier: 'games_starter', daily_limit: 1000, monthly_limit: 10000 },
    [process.env.STRIPE_PRICE_GAMES_PRO_MONTHLY]: { tier: 'games_pro', daily_limit: 25000, monthly_limit: 250000 },
    [process.env.STRIPE_PRICE_GAMES_PRO_ANNUAL]: { tier: 'games_pro', daily_limit: 25000, monthly_limit: 250000 },
    // Film
    [process.env.STRIPE_PRICE_FILM_STARTER_MONTHLY]: { tier: 'film_starter', daily_limit: 5000, monthly_limit: 50000 },
    [process.env.STRIPE_PRICE_FILM_STARTER_ANNUAL]: { tier: 'film_starter', daily_limit: 5000, monthly_limit: 50000 },
    [process.env.STRIPE_PRICE_FILM_PRO_MONTHLY]: { tier: 'film_pro', daily_limit: 50000, monthly_limit: 500000 },
    [process.env.STRIPE_PRICE_FILM_PRO_ANNUAL]: { tier: 'film_pro', daily_limit: 50000, monthly_limit: 500000 },
    // Bundle
    [process.env.STRIPE_PRICE_BUNDLE_STARTER_MONTHLY]: { tier: 'bundle_starter', daily_limit: 6000, monthly_limit: 60000 },
    [process.env.STRIPE_PRICE_BUNDLE_STARTER_ANNUAL]: { tier: 'bundle_starter', daily_limit: 6000, monthly_limit: 60000 },
    [process.env.STRIPE_PRICE_BUNDLE_PRO_MONTHLY]: { tier: 'bundle_pro', daily_limit: 70000, monthly_limit: 700000 },
    [process.env.STRIPE_PRICE_BUNDLE_PRO_ANNUAL]: { tier: 'bundle_pro', daily_limit: 70000, monthly_limit: 700000 },
    // Deprecated (legacy) - fallback support
    'price_professional_monthly': { tier: 'professional', daily_limit: 3333, monthly_limit: 100000 },
    'price_professional_annual': { tier: 'professional', daily_limit: 3333, monthly_limit: 100000 },
    'price_enterprise_monthly': { tier: 'enterprise', daily_limit: 33333, monthly_limit: 1000000 },
    'price_enterprise_annual': { tier: 'enterprise', daily_limit: 33333, monthly_limit: 1000000 }
  };

  return planMap[priceId] || { tier: 'free', daily_limit: 1000, monthly_limit: 1000 };
}

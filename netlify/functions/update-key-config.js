'use strict';

const db = require('../../config/database');

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-admin-token',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const isDev = process.env.NETLIFY_DEV === 'true';
  const token = event.headers['x-admin-token'] || event.headers['X-Admin-Token'];
  const required = process.env.ADMIN_PROVISION_TOKEN || '';

  if (!isDev && (!required || token !== required)) {
    return json(403, { error: 'Forbidden' });
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const apiKey = body.api_key || body.key;
    if (!apiKey || typeof apiKey !== 'string') {
      return json(400, { error: 'Missing api_key' });
    }

    const domains = Array.isArray(body.domains)
      ? body.domains
      : (typeof body.domains === 'string'
          ? body.domains.split(',').map(s => s.trim()).filter(Boolean)
          : undefined);

    const tier = body.tier; // 'free' | 'professional' | 'enterprise'
    const daily = body.daily_limit;
    const monthly = body.monthly_limit;
    const stripeCustomer = body.stripe_customer_id || null;
    const stripeSubscription = body.stripe_subscription_id || null;

    const sql = db.init();

    const result = { api_key_preview: apiKey.slice(0, 4) + '...' + apiKey.slice(-4) };

    if (domains && domains.length) {
      try {
        await sql`SELECT update_api_key_domains(${apiKey}, ${sql.array(domains, 'text')})`;
        result.domains_updated = true;
      } catch (e) {
        result.domains_updated = false;
        result.domains_error = e.message;
      }
    }

    if (tier || daily != null || monthly != null || stripeCustomer || stripeSubscription) {
      try {
        const t = tier || 'professional';
        const d = daily != null ? daily : 10000;
        const m = monthly != null ? monthly : 300000;
        await sql`SELECT update_api_key_limits(${apiKey}, ${t}, ${d}, ${m}, ${stripeCustomer}, ${stripeSubscription})`;
        result.limits_updated = true;
      } catch (e) {
        result.limits_updated = false;
        result.limits_error = e.message;
      }
    }

    // Return validation snapshot
    try {
      const validation = await db.validateApiKey(apiKey);
      result.validation = validation;
    } catch (e) {
      result.validation_error = e.message;
    }

    return json(200, result);
  } catch (err) {
    console.error('update-key-config error', err);
    return json(500, { error: 'Internal server error' });
  }
};

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
    const email = body.email || process.env.ADMIN_EMAIL || 'greg@awardsapi.local';
    const name = body.name || process.env.ADMIN_NAME || 'Local Admin';
    const company = body.company || process.env.ADMIN_COMPANY || null;

    const result = await db.generateApiKey(email, name, company, 'admin', 'Administrative key with full access');
    if (!result || !result.success || !result.api_key) {
      return json(500, { error: result?.error || 'Failed to generate key' });
    }
    // Attempt to elevate domains and limits; ignore failures in dev to avoid blocking key creation
    try {
      const sql = db.init();
      await sql`SELECT update_api_key_domains(${result.api_key}, ARRAY['games','film']::TEXT[])`;
      await sql`SELECT update_api_key_limits(${result.api_key}, 'enterprise', 100000, 1000000, NULL, NULL)`;
    } catch (e) {
      console.error('admin-create-key elevation error (non-fatal):', e.message);
    }

    return json(200, { success: true, email, name, api_key: result.api_key });
  } catch (err) {
    console.error('admin-create-key error', err);
    return json(500, { error: 'Internal server error' });
  }
};

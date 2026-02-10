#!/usr/bin/env node
'use strict';

/**
 * Create an admin API key with access to both domains and high limits.
 * Usage:
 *   node -r dotenv/config scripts/create-admin-key.js [email] [name]
 * Defaults:
 *   email: process.env.ADMIN_EMAIL || 'greg@awardsapi.local'
 *   name:  process.env.ADMIN_NAME  || 'Local Admin'
 */

const db = require('../config/database');

async function main() {
  const email = process.argv[2] || process.env.ADMIN_EMAIL || 'greg@awardsapi.local';
  const name = process.argv[3] || process.env.ADMIN_NAME || 'Local Admin';
  const company = process.env.ADMIN_COMPANY || null;
  const useCase = 'admin';
  const description = 'Administrative key with full access (local)';

  const sql = db.init();

  // 1) Generate a key (or update user if email exists)
  const res = await db.generateApiKey(email, name, company, useCase, description);
  if (!res || !res.success || !res.api_key) {
    console.error('Failed to generate API key:', res && res.error);
    process.exit(1);
  }
  const apiKey = res.api_key;

  // 2) Grant both domains
  const domainsUpdated = await sql`SELECT update_api_key_domains(${apiKey}, ARRAY['games','film']::TEXT[]) AS ok`;
  // 3) Bump limits and set tier
  const limitsUpdated = await sql`SELECT update_api_key_limits(${apiKey}, 'enterprise', 100000, 1000000, NULL, NULL) AS ok`;

  const out = {
    success: true,
    email,
    name,
    api_key: apiKey,
    domains_updated: !!(domainsUpdated?.[0]?.ok),
    limits_updated: !!(limitsUpdated?.[0]?.ok)
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

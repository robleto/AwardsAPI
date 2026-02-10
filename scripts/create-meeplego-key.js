#!/usr/bin/env node
const db = require('../config/database');

async function createMeepleGoKey() {
  try {
    console.log('Creating API key for MeepleGo project...');
    
    const result = await db.generateApiKey(
      'greg@meeplego.com',
      'Greg Robleto',
      'MeepleGo',
      'Board game awards integration',
      'API key for MeepleGo board game platform'
    );

    if (!result || !result.success) {
      console.error('Failed to generate API key:', result?.error || 'Unknown error');
      process.exit(1);
    }

    console.log('\n✅ API Key created successfully!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Email:', 'greg@meeplego.com');
    console.log('Company:', 'MeepleGo');
    console.log('API Key:', result.api_key);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Attempt to elevate to enterprise tier
    try {
      const sql = db.init();
      await sql`SELECT update_api_key_domains(${result.api_key}, ARRAY['games','film']::TEXT[])`;
      await sql`SELECT update_api_key_limits(${result.api_key}, 'enterprise', 100000, 1000000, NULL, NULL)`;
      console.log('✅ Upgraded to Enterprise tier with full access to games and film domains\n');
    } catch (e) {
      console.error('⚠️  Could not upgrade to enterprise tier:', e.message);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createMeepleGoKey();

// Update api_keys.tier CHECK constraint to include new domain-specific tiers
const { neon } = require('@neondatabase/serverless');

(async () => {
  try {
    if (!process.env.DATABASE_URL) throw new Error('Missing DATABASE_URL');
    const sql = neon(process.env.DATABASE_URL);

    await sql('ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;');
    await sql("ALTER TABLE api_keys ADD CONSTRAINT api_keys_tier_check CHECK (\n  tier IN (\n    'free',\n    'professional','enterprise',\n    'games_starter','games_pro',\n    'film_starter','film_pro',\n    'bundle_starter','bundle_pro'\n  )\n);");
    console.log('api_keys tier CHECK constraint updated');
  } catch (e) {
    console.error('Tier patch failed:', e.message);
    process.exit(1);
  }
})();

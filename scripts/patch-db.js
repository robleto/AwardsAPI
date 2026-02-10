// Apply critical DB function patches via Neon using DATABASE_URL
const { neon } = require('@neondatabase/serverless');

(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Missing DATABASE_URL');
    }
    const sql = neon(process.env.DATABASE_URL);

    const ddl = `
CREATE OR REPLACE FUNCTION update_api_key_limits(
  api_key_value TEXT,
  new_tier TEXT,
  new_daily_limit INTEGER,
  new_monthly_limit INTEGER,
  stripe_customer TEXT DEFAULT NULL,
  stripe_subscription TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_key_hash TEXT;
BEGIN
  v_key_hash := encode(digest(api_key_value, 'sha256'), 'hex');
  
  UPDATE api_keys
  SET 
    tier = new_tier,
    daily_limit = new_daily_limit,
    monthly_limit = new_monthly_limit,
    stripe_customer_id = COALESCE(stripe_customer, stripe_customer_id),
    stripe_subscription_id = COALESCE(stripe_subscription, stripe_subscription_id),
    updated_at = NOW()
  WHERE api_keys.key_hash = v_key_hash;
  
  RETURN FOUND;
END;
$$;`;

    await sql(ddl);
    console.log('update_api_key_limits patched successfully');
  } catch (e) {
    console.error('Patch failed:', e.message);
    process.exit(1);
  }
})();

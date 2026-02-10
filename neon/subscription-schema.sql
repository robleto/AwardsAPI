-- Enhanced schema for subscription management
-- Add these columns to your existing api_keys table

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS monthly_limit INTEGER DEFAULT 1000;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS monthly_usage INTEGER DEFAULT 0;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_monthly_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;

-- Create subscription management functions
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
$$;

CREATE OR REPLACE FUNCTION update_api_keys_by_stripe_customer(
  customer_id TEXT,
  new_tier TEXT,
  new_daily_limit INTEGER,
  new_monthly_limit INTEGER,
  subscription_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE api_keys
  SET 
    tier = new_tier,
    daily_limit = new_daily_limit,
    monthly_limit = new_monthly_limit,
    stripe_subscription_id = subscription_id,
    is_suspended = FALSE,
    updated_at = NOW()
  WHERE stripe_customer_id = customer_id;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION suspend_api_keys_by_stripe_customer(
  customer_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  suspended_count INTEGER;
BEGIN
  UPDATE api_keys
  SET 
    is_suspended = TRUE,
    updated_at = NOW()
  WHERE stripe_customer_id = customer_id;
  
  GET DIAGNOSTICS suspended_count = ROW_COUNT;
  RETURN suspended_count;
END;
$$;

CREATE OR REPLACE FUNCTION restore_api_keys_by_stripe_customer(
  customer_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  restored_count INTEGER;
BEGIN
  UPDATE api_keys
  SET 
    is_suspended = FALSE,
    monthly_usage = 0,
    last_monthly_reset = NOW(),
    updated_at = NOW()
  WHERE stripe_customer_id = customer_id;
  
  GET DIAGNOSTICS restored_count = ROW_COUNT;
  RETURN restored_count;
END;
$$;

-- Enhanced validate_api_key function with monthly limits
CREATE OR REPLACE FUNCTION validate_api_key_enhanced(key_to_check TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  key_hash TEXT;
  key_record RECORD;
BEGIN
  -- Hash the provided key
  key_hash := encode(digest(key_to_check, 'sha256'), 'hex');

  -- Get key record
  SELECT * INTO key_record
  FROM api_keys
  WHERE api_keys.key_hash = validate_api_key_enhanced.key_hash
  AND is_active = true
  AND is_suspended = false;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Invalid or suspended API key'
    );
  END IF;

  -- Check if we need to reset daily limits
  IF DATE(key_record.last_reset_at) < CURRENT_DATE THEN
    UPDATE api_keys
    SET 
      requests_remaining = daily_limit,
      last_reset_at = NOW()
    WHERE id = key_record.id;
    
    key_record.requests_remaining := key_record.daily_limit;
  END IF;

  -- Check if we need to reset monthly limits
  IF EXTRACT(MONTH FROM key_record.last_monthly_reset) != EXTRACT(MONTH FROM NOW()) 
     OR EXTRACT(YEAR FROM key_record.last_monthly_reset) != EXTRACT(YEAR FROM NOW()) THEN
    UPDATE api_keys
    SET 
      monthly_usage = 0,
      last_monthly_reset = NOW()
    WHERE id = key_record.id;
    
    key_record.monthly_usage := 0;
  END IF;

  -- Check daily rate limits
  IF key_record.requests_remaining <= 0 THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Daily rate limit exceeded'
    );
  END IF;

  -- Check monthly rate limits
  IF key_record.monthly_usage >= key_record.monthly_limit THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Monthly rate limit exceeded'
    );
  END IF;

  -- Decrement usage
  UPDATE api_keys
  SET 
    requests_remaining = requests_remaining - 1,
    requests_total = requests_total + 1,
    monthly_usage = monthly_usage + 1,
    last_request_at = NOW()
  WHERE id = key_record.id;

  RETURN json_build_object(
    'valid', true,
    'tier', key_record.tier,
    'requests_remaining_today', key_record.requests_remaining - 1,
    'requests_remaining_month', key_record.monthly_limit - key_record.monthly_usage - 1,
    'daily_limit', key_record.daily_limit,
    'monthly_limit', key_record.monthly_limit
  );
END;
$$;

-- Add domain access control to API keys
-- Date: 2025-11-14
-- Enables per-key domain restrictions (games, film, or both)

-- Add allowed_domains column
ALTER TABLE api_keys 
ADD COLUMN IF NOT EXISTS allowed_domains TEXT[] DEFAULT ARRAY['games']::TEXT[];

-- Add comment
COMMENT ON COLUMN api_keys.allowed_domains IS 'Array of domains this key can access: games, film, or both';

-- Create index for domain lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_allowed_domains ON api_keys USING GIN (allowed_domains);

-- Update existing keys to have games access (backward compatibility)
UPDATE api_keys 
SET allowed_domains = ARRAY['games']::TEXT[]
WHERE allowed_domains IS NULL OR allowed_domains = '{}';

-- Enhanced validation function with domain check
CREATE OR REPLACE FUNCTION validate_api_key_with_domain(
  key_to_check TEXT,
  requested_domain TEXT DEFAULT 'games'
)
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
  WHERE api_keys.key_hash = validate_api_key_with_domain.key_hash
  AND is_active = true
  AND is_suspended = false;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'valid', false,
      'error', 'Invalid or suspended API key'
    );
  END IF;

  -- Check domain access
  IF NOT (requested_domain = ANY(key_record.allowed_domains)) THEN
    RETURN json_build_object(
      'valid', false,
      'error', format('API key does not have access to %s domain', requested_domain),
      'allowed_domains', key_record.allowed_domains
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
    'allowed_domains', key_record.allowed_domains,
    'requests_remaining_today', key_record.requests_remaining - 1,
    'requests_remaining_month', key_record.monthly_limit - key_record.monthly_usage - 1,
    'daily_limit', key_record.daily_limit,
    'monthly_limit', key_record.monthly_limit
  );
END;
$$;

-- Function to update key domains
CREATE OR REPLACE FUNCTION update_api_key_domains(
  api_key_value TEXT,
  new_domains TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  key_hash TEXT;
BEGIN
  key_hash := encode(digest(api_key_value, 'sha256'), 'hex');
  
  UPDATE api_keys
  SET 
    allowed_domains = new_domains,
    updated_at = NOW()
  WHERE key_hash = update_api_key_domains.key_hash;
  
  RETURN FOUND;
END;
$$;

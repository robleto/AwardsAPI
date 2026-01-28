-- Update validate_api_key_enhanced to include allowed_domains
-- Date: 2025-11-15
-- Adds allowed_domains to the returned validation JSON

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
    'allowed_domains', key_record.allowed_domains,
    'requests_remaining_today', key_record.requests_remaining - 1,
    'requests_remaining_month', key_record.monthly_limit - key_record.monthly_usage - 1,
    'daily_limit', key_record.daily_limit,
    'monthly_limit', key_record.monthly_limit
  );
END;
$$;

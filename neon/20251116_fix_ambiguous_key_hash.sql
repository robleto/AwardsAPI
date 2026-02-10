-- Fix ambiguous key_hash references by using explicit local variables
-- and fully-qualifying table columns in WHERE clauses.

-- update_api_key_domains
CREATE OR REPLACE FUNCTION update_api_key_domains(
  api_key_value TEXT,
  new_domains TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_key_hash TEXT;
BEGIN
  v_key_hash := encode(digest(api_key_value, 'sha256'), 'hex');
  UPDATE api_keys
  SET allowed_domains = new_domains,
      updated_at = NOW()
  WHERE api_keys.key_hash = v_key_hash;
  RETURN FOUND;
END;
$$;

-- validate_api_key_with_domain
CREATE OR REPLACE FUNCTION validate_api_key_with_domain(
  key_to_check TEXT,
  requested_domain TEXT DEFAULT 'games'
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_key_hash TEXT;
  key_record RECORD;
BEGIN
  v_key_hash := encode(digest(key_to_check, 'sha256'), 'hex');

  SELECT * INTO key_record
  FROM api_keys
  WHERE api_keys.key_hash = v_key_hash
    AND is_active = true
    AND is_suspended = false;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or suspended API key');
  END IF;

  IF NOT (requested_domain = ANY(key_record.allowed_domains)) THEN
    RETURN json_build_object(
      'valid', false,
      'error', format('API key does not have access to %s domain', requested_domain),
      'allowed_domains', key_record.allowed_domains
    );
  END IF;

  IF DATE(key_record.last_reset_at) < CURRENT_DATE THEN
    UPDATE api_keys
    SET requests_remaining = daily_limit,
        last_reset_at = NOW()
    WHERE id = key_record.id;
    key_record.requests_remaining := key_record.daily_limit;
  END IF;

  IF EXTRACT(MONTH FROM key_record.last_monthly_reset) != EXTRACT(MONTH FROM NOW())
     OR EXTRACT(YEAR FROM key_record.last_monthly_reset) != EXTRACT(YEAR FROM NOW()) THEN
    UPDATE api_keys
    SET monthly_usage = 0,
        last_monthly_reset = NOW()
    WHERE id = key_record.id;
    key_record.monthly_usage := 0;
  END IF;

  IF key_record.requests_remaining <= 0 THEN
    RETURN json_build_object('valid', false, 'error', 'Daily rate limit exceeded');
  END IF;

  IF key_record.monthly_usage >= key_record.monthly_limit THEN
    RETURN json_build_object('valid', false, 'error', 'Monthly rate limit exceeded');
  END IF;

  UPDATE api_keys
  SET requests_remaining = requests_remaining - 1,
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

-- validate_api_key_enhanced
CREATE OR REPLACE FUNCTION validate_api_key_enhanced(key_to_check TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_key_hash TEXT;
  key_record RECORD;
BEGIN
  v_key_hash := encode(digest(key_to_check, 'sha256'), 'hex');

  SELECT * INTO key_record
  FROM api_keys
  WHERE api_keys.key_hash = v_key_hash
    AND is_active = true
    AND is_suspended = false;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid or suspended API key');
  END IF;

  IF DATE(key_record.last_reset_at) < CURRENT_DATE THEN
    UPDATE api_keys
    SET requests_remaining = daily_limit,
        last_reset_at = NOW()
    WHERE id = key_record.id;
    key_record.requests_remaining := key_record.daily_limit;
  END IF;

  IF EXTRACT(MONTH FROM key_record.last_monthly_reset) != EXTRACT(MONTH FROM NOW())
     OR EXTRACT(YEAR FROM key_record.last_monthly_reset) != EXTRACT(YEAR FROM NOW()) THEN
    UPDATE api_keys
    SET monthly_usage = 0,
        last_monthly_reset = NOW()
    WHERE id = key_record.id;
    key_record.monthly_usage := 0;
  END IF;

  IF key_record.requests_remaining <= 0 THEN
    RETURN json_build_object('valid', false, 'error', 'Daily rate limit exceeded');
  END IF;

  IF key_record.monthly_usage >= key_record.monthly_limit THEN
    RETURN json_build_object('valid', false, 'error', 'Monthly rate limit exceeded');
  END IF;

  UPDATE api_keys
  SET requests_remaining = requests_remaining - 1,
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

-- validate_api_key (base)
CREATE OR REPLACE FUNCTION validate_api_key(key_to_check TEXT)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_key_hash TEXT;
  key_record RECORD;
BEGIN
  v_key_hash := encode(digest(key_to_check, 'sha256'), 'hex');

  SELECT * INTO key_record
  FROM api_keys
  WHERE api_keys.key_hash = v_key_hash
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  IF DATE(key_record.last_reset_at) < CURRENT_DATE THEN
    UPDATE api_keys
    SET requests_remaining = daily_limit,
        last_reset_at = NOW()
    WHERE id = key_record.id;
    key_record.requests_remaining := key_record.daily_limit;
  END IF;

  IF key_record.requests_remaining <= 0 THEN
    RETURN json_build_object('valid', false, 'error', 'Rate limit exceeded');
  END IF;

  UPDATE api_keys
  SET requests_remaining = requests_remaining - 1,
      requests_total = requests_total + 1,
      last_request_at = NOW()
  WHERE id = key_record.id;

  RETURN json_build_object(
    'valid', true,
    'tier', key_record.tier,
    'requests_remaining', key_record.requests_remaining - 1,
    'daily_limit', key_record.daily_limit
  );
END;
$$;

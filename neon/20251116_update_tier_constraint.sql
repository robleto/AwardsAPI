-- Update tier CHECK constraint to include domain-specific tiers
ALTER TABLE api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
ALTER TABLE api_keys ADD CONSTRAINT api_keys_tier_check CHECK (
  tier IN (
    'free',
    'professional','enterprise',
    'games_starter','games_pro',
    'film_starter','film_pro',
    'bundle_starter','bundle_pro'
  )
);

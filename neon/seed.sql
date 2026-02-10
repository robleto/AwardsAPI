-- Neon seed data (adapted from Supabase seed)
-- Insert demo users
INSERT INTO users (id, email, name, company, use_case, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'demo@gameawards.com', 'Demo User', 'Game Awards API', 'testing', 'Demo account for testing'),
  ('00000000-0000-0000-0000-000000000002', 'developer@example.com', 'Jane Developer', 'Indie Games Studio', 'mobile_app', 'Building a board game collection app'),
  ('00000000-0000-0000-0000-000000000003', 'researcher@university.edu', 'Dr. Game Scholar', 'University Research', 'research', 'Academic study on game award trends')
ON CONFLICT (email) DO NOTHING;

-- Insert demo API keys (hashes only; raw keys not stored)
INSERT INTO api_keys (user_id, key_hash, key_preview, tier, daily_limit, requests_remaining) VALUES
  ('00000000-0000-0000-0000-000000000001', encode(digest('gaa_demo_key_for_testing_only', 'sha256'), 'hex'), 'gaa_demo...', 'free', 1000, 1000),
  ('00000000-0000-0000-0000-000000000002', encode(digest('gaa_dev_key_for_mobile_app', 'sha256'), 'hex'), 'gaa_dev_...', 'professional', 100000, 100000),
  ('00000000-0000-0000-0000-000000000003', encode(digest('gaa_research_university_key', 'sha256'), 'hex'), 'gaa_rese...', 'enterprise', 1000000, 1000000)
ON CONFLICT (key_hash) DO NOTHING;

-- Sample usage rows
INSERT INTO api_usage (api_key, endpoint, parameters, status_code, timestamp) VALUES
  ('gaa_demo_key_for_testing_only', '/api/', '{"s": "Spiel des Jahres"}', 200, now() - interval '1 hour'),
  ('gaa_demo_key_for_testing_only', '/api/', '{"game_id": "game_qsi3zo"}', 200, now() - interval '2 hours'),
  ('gaa_dev_key_for_mobile_app', '/api/', '{"s": "Origins"}', 200, now() - interval '30 minutes'),
  ('gaa_research_university_key', '/api/awards', '{}', 200, now() - interval '45 minutes')
ON CONFLICT DO NOTHING;

-- Board games awards schema for Neon
-- Stores board game awards with normalized search fields

CREATE SCHEMA IF NOT EXISTS boardgames;

CREATE TABLE IF NOT EXISTS boardgames.games (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boardgames_games_normalized_name ON boardgames.games(normalized_name);

CREATE TABLE IF NOT EXISTS boardgames.awards (
  id TEXT PRIMARY KEY,
  slug TEXT,
  url TEXT,
  year INTEGER,
  title TEXT,
  primary_name TEXT,
  award_set_raw TEXT,
  award_set TEXT,
  position TEXT,
  is_winner BOOLEAN DEFAULT false,
  is_nominee BOOLEAN DEFAULT false,
  alternate_names TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boardgames_awards_year ON boardgames.awards(year);
CREATE INDEX IF NOT EXISTS idx_boardgames_awards_award_set ON boardgames.awards(award_set);
CREATE INDEX IF NOT EXISTS idx_boardgames_awards_title ON boardgames.awards(title);
CREATE INDEX IF NOT EXISTS idx_boardgames_awards_position ON boardgames.awards(position);

CREATE TABLE IF NOT EXISTS boardgames.award_games (
  award_id TEXT NOT NULL REFERENCES boardgames.awards(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL REFERENCES boardgames.games(id) ON DELETE CASCADE,
  PRIMARY KEY (award_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_boardgames_award_games_game_id ON boardgames.award_games(game_id);

CREATE OR REPLACE VIEW boardgames.game_awards AS
SELECT
  ag.game_id,
  g.name AS game_name,
  a.id AS award_id,
  a.year,
  a.title,
  a.award_set,
  a.position,
  a.is_winner,
  a.is_nominee
FROM boardgames.award_games ag
JOIN boardgames.games g ON g.id = ag.game_id
JOIN boardgames.awards a ON a.id = ag.award_id;

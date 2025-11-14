-- Awards API: Film domain schema and helper functions
-- Date: 2025-11-13
-- Safe to run multiple times (CREATE IF NOT EXISTS + idempotent indexes)

-- Domain: film
-- Core entities
CREATE TABLE IF NOT EXISTS ceremonies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL DEFAULT 'film',
  organization TEXT NOT NULL,           -- e.g., 'Academy Awards'
  name TEXT NOT NULL,                   -- e.g., 'Oscars 2024'
  year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (domain, organization, year)
);

CREATE TABLE IF NOT EXISTS award_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ceremony_id UUID NOT NULL REFERENCES ceremonies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ceremony_id, name)
);

CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES award_categories(id) ON DELETE CASCADE,
  imdb_id TEXT NOT NULL,                -- e.g., 'tt0133093'
  title TEXT NOT NULL,                  -- film title
  is_win BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category_id, imdb_id)
);

CREATE TABLE IF NOT EXISTS nomination_people (
  nomination_id UUID NOT NULL REFERENCES nominations(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nomination_id, person_id, role)
);

-- Quick helper view for film domain nominations
CREATE OR REPLACE VIEW film_nominations AS
SELECT n.id AS nomination_id,
       c.year,
       ce.organization,
       ce.name AS ceremony_name,
       ac.name AS category_name,
       n.imdb_id,
       n.title,
       n.is_win
FROM nominations n
JOIN award_categories ac ON ac.id = n.category_id
JOIN ceremonies ce ON ce.id = ac.ceremony_id
WHERE ce.domain = 'film';

-- Function: get_film_awards_by_imdb
-- Returns nested JSON with nominations grouped by ceremony and category + stats
CREATE OR REPLACE FUNCTION get_film_awards_by_imdb(p_imdb_id TEXT)
RETURNS JSONB
LANGUAGE sql
AS $$
WITH base AS (
  SELECT
    ce.year,
    ce.organization,
    ce.name AS ceremony_name,
    ac.name AS category_name,
    n.is_win,
    n.title,
    n.imdb_id
  FROM nominations n
  JOIN award_categories ac ON ac.id = n.category_id
  JOIN ceremonies ce ON ce.id = ac.ceremony_id
  WHERE ce.domain = 'film' AND n.imdb_id = p_imdb_id
),
by_category AS (
  SELECT
    ceremony_name,
    year,
    organization,
    jsonb_agg(
      jsonb_build_object(
        'category', category_name,
        'win', is_win
      )
      ORDER BY category_name
    ) AS categories
  FROM base
  GROUP BY ceremony_name, year, organization
),
stats AS (
  SELECT
    count(*) AS nominations,
    count(*) FILTER (WHERE is_win) AS wins
  FROM base
)
SELECT CASE WHEN (SELECT count(*) FROM base) = 0 THEN NULL ELSE
  jsonb_build_object(
    'nominations', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'ceremony', b.ceremony_name,
          'year', b.year,
          'organization', b.organization,
          'categories', b.categories
        ) ORDER BY b.year DESC
      ) FROM by_category b
    ),
    'stats', (
      SELECT jsonb_build_object('nominations', nominations, 'wins', wins) FROM stats
    )
  )
END $$;

-- Function: get_film_award_badges_by_imdb
-- Returns a compact list of badges like ['Oscar Winner', 'Oscar Nominee']
CREATE OR REPLACE FUNCTION get_film_award_badges_by_imdb(p_imdb_id TEXT)
RETURNS JSONB
LANGUAGE sql
AS $$
WITH base AS (
  SELECT ce.organization, n.is_win
  FROM nominations n
  JOIN award_categories ac ON ac.id = n.category_id
  JOIN ceremonies ce ON ce.id = ac.ceremony_id
  WHERE ce.domain = 'film' AND n.imdb_id = p_imdb_id
),
badges AS (
  SELECT DISTINCT
    CASE WHEN is_win THEN organization || ' Winner' ELSE organization || ' Nominee' END AS badge
  FROM base
)
SELECT COALESCE(jsonb_agg(badge ORDER BY badge), '[]'::jsonb) FROM badges
$$;

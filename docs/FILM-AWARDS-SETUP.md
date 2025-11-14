# Film Awards Feature - Setup & Testing Guide

## Overview

This feature adds film awards data (starting with Academy Awards/Oscars) to the Awards API, expanding it from a game-only API to a multi-domain awards platform.

## Quick Start

### 1. Apply the Migration

**Option A: Neon SQL Editor**
1. Open your Neon project dashboard
2. Navigate to SQL Editor
3. Open `neon/20251113_awards_film_schema.sql`
4. Run the entire file

**Option B: Command Line (psql)**
```bash
export DATABASE_URL="postgres://USER:PASSWORD@HOST/DB?sslmode=require"
psql "$DATABASE_URL" -f neon/20251113_awards_film_schema.sql
```

### 2. Validate Migration

```bash
node scripts/validate-film-schema.js
```

Expected output:
```
✅ Table: ceremonies
✅ Table: award_categories
✅ Table: people
✅ Table: nominations
✅ Table: nomination_people
✅ View: film_nominations
✅ Function: get_film_awards_by_imdb
✅ Function: get_film_award_badges_by_imdb

📊 Results: 8 passed, 0 failed
✨ Migration validated successfully!
```

### 3. Seed Sample Data

```bash
node scripts/import-oscars.js data/oscars_sample.json
```

This loads:
- 3 IMDb titles (The Matrix, Oppenheimer, Barbie, Everything Everywhere All at Once)
- 10 nominations across multiple years
- 6 wins

### 4. Test Locally

```bash
# Terminal 1: Start Netlify Dev
npm run netlify:dev

# Terminal 2: Query the endpoint
curl "http://localhost:8888/film-awards?imdb_id=tt0133093" | jq

# Or use the helper script
node scripts/query-film-awards.js tt0133093
```

## Files Added

### Core Implementation
- `neon/20251113_awards_film_schema.sql` - Database schema and functions
- `netlify/functions/film-awards.js` - API endpoint
- `scripts/import-oscars.js` - Idempotent data importer

### Documentation
- `docs/api/film.md` - Complete API documentation
- `README.md` - Updated with film domain info

### Testing & Utilities
- `data/oscars_sample.json` - Sample test data
- `scripts/query-film-awards.js` - CLI query tool
- `scripts/validate-film-schema.js` - Schema validation

### Configuration
- `netlify.toml` - Added `/film-awards` redirect

## Database Schema

### Tables

**ceremonies**
- Stores award ceremonies (year, organization, name)
- Unique: (domain, organization, year)

**award_categories**
- Categories within each ceremony
- Unique: (ceremony_id, name)

**people**
- Directors, actors, producers, etc.
- Unique: name

**nominations**
- Film nominations for categories
- Links to IMDb via `imdb_id`
- Unique: (category_id, imdb_id)

**nomination_people**
- Many-to-many link between nominations and people
- Tracks role (Director, Actor, Producer, etc.)

### Functions

**get_film_awards_by_imdb(p_imdb_id TEXT)**
- Returns nested JSON with all nominations grouped by ceremony
- Includes stats (total nominations, total wins)

**get_film_award_badges_by_imdb(p_imdb_id TEXT)**
- Returns simple badge array for UI display
- Examples: "Academy Awards Winner", "Academy Awards Nominee"

## API Usage

### Request

```bash
GET /film-awards?imdb_id=tt0133093
Header: x-api-key: YOUR_KEY
```

### Response (200 OK)

```json
{
  "imdb_id": "tt0133093",
  "nominations": [
    {
      "ceremony": "72nd Academy Awards",
      "year": 1999,
      "organization": "Academy Awards",
      "categories": [
        { "category": "Best Visual Effects", "win": true },
        { "category": "Best Film Editing", "win": true },
        { "category": "Best Sound", "win": true }
      ]
    }
  ],
  "badges": ["Academy Awards Winner"],
  "stats": { "nominations": 3, "wins": 3 }
}
```

### Error Responses

- `400` - Invalid/missing imdb_id
- `401` - Missing/invalid API key (production only)
- `404` - No awards found for this film
- `429` - Rate limit exceeded
- `500` - Internal server error

## Data Ingestion

### JSON Format

```json
[
  {
    "ceremony_year": 2024,
    "org_name": "Academy Awards",
    "ceremony_name": "96th Academy Awards",
    "category_name": "Best Picture",
    "imdb_id": "tt15398776",
    "film_title": "Oppenheimer",
    "is_win": true,
    "people": [
      { "name": "Christopher Nolan", "role": "Director" }
    ]
  }
]
```

### Import

```bash
node scripts/import-oscars.js path/to/your/data.json
```

**Features:**
- Idempotent: safe to run multiple times
- Upserts all records (no duplicates)
- Updates wins if data changes
- Links people automatically

## ReAwarding Integration

### Environment Variables

```env
AWARDS_API_BASE_URL=https://gameawards.netlify.app
AWARDS_API_KEY=your_comp_key_here
```

### Server Component Example

```typescript
async function getFilmAwards(imdbId: string) {
  const url = `${process.env.AWARDS_API_BASE_URL}/film-awards?imdb_id=${imdbId}`;
  const res = await fetch(url, {
    headers: { 'x-api-key': process.env.AWARDS_API_KEY! }
  });
  
  if (!res.ok) return null;
  return await res.json();
}

// In your film page
const awards = await getFilmAwards(film.imdb_id);
if (awards) {
  // Render badges
  awards.badges.forEach(badge => console.log(badge));
  // Render nominations
  awards.nominations.forEach(nom => { /* ... */ });
}
```

## Testing Checklist

- [ ] Migration applied successfully
- [ ] All tables and functions exist (run `validate-film-schema.js`)
- [ ] Sample data imported without errors
- [ ] Query script returns data for tt0133093
- [ ] Netlify Dev serves endpoint at http://localhost:8888/film-awards
- [ ] curl returns 200 with valid data
- [ ] curl returns 404 for unknown imdb_id
- [ ] curl returns 400 for malformed imdb_id
- [ ] Re-running import is idempotent (no duplicates)

## Next Steps

### Production Deployment

1. **Apply migration to production Neon**
   ```bash
   psql "$PROD_DATABASE_URL" -f neon/20251113_awards_film_schema.sql
   ```

2. **Merge feature branch**
   ```bash
   git checkout main
   git merge feat/film-awards
   git push origin main
   ```

3. **Netlify auto-deploys** (if configured)

4. **Generate comp API key for ReAwarding**
   ```bash
   # Via your existing generate-key function
   # Then update limits:
   # tier=internal, daily_limit=50000, monthly_limit=1000000
   ```

### Data Expansion

- Import full Oscars history (1929-2024)
- Add Golden Globes
- Add BAFTA
- Add SAG Awards
- Add Critics Choice

## Troubleshooting

### "Internal server error" in local dev

**Cause:** Missing DATABASE_URL

**Fix:**
```bash
export DATABASE_URL="postgres://..."
# Or create .env file with DATABASE_URL
npm run netlify:dev
```

### Migration fails with "relation already exists"

**Not a problem!** Schema uses `IF NOT EXISTS` - safe to re-run.

### Import creates duplicate nominations

**Check:** Verify unique constraint exists:
```sql
SELECT * FROM pg_constraint 
WHERE conrelid = 'nominations'::regclass;
```

Should see: `nominations_category_id_imdb_id_key`

### Rate limits hit during testing

**Local dev:** API key validation is disabled (NETLIFY_DEV=true)

**Production:** Use a key with high limits or generate an internal key

## Support

- 📧 Email: support@gameawardsapi.com
- 📚 Main docs: [README.md](../README.md)
- 🎬 Film API docs: [docs/api/film.md](docs/api/film.md)

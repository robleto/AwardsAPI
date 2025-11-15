# Film Awards API Documentation

## Overview

The Film Awards API provides access to comprehensive film awards data including Academy Awards (Oscars), with planned expansion to other major ceremonies.

## Endpoint

```
GET /film-awards
GET /.netlify/functions/film-awards
```

## Authentication

Requires a valid API key via one of:
- Header: `x-api-key: your_key_here`
- Query parameter: `?apikey=your_key_here`

## Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `imdb_id` | string | Yes | IMDb identifier (format: `tt` + 7+ digits) |

**Alternative parameter names:**
- `imdb` - Alias for `imdb_id`
- `i` - Short alias for `imdb_id`

## Response Format

### Success (200 OK)

```json
{
  "imdb_id": "tt0133093",
  "nominations": [
    {
      "ceremony": "72nd Academy Awards",
      "year": 1999,
      "organization": "Academy Awards",
      "categories": [
        {
          "category": "Best Visual Effects",
          "win": true
        },
        {
          "category": "Best Film Editing",
          "win": true
        },
        {
          "category": "Best Sound",
          "win": true
        }
      ]
    }
  ],
  "badges": [
    "Academy Awards Winner"
  ],
  "stats": {
    "nominations": 3,
    "wins": 3
  }
}
```

### Not Found (404)

```json
{
  "error": "No awards found for imdb_id",
  "imdb_id": "tt9999999"
}
```

### Errors

| Status | Description |
|--------|-------------|
| 400 | Invalid or missing `imdb_id` parameter |
| 401 | Missing or invalid API key |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

## Examples

### cURL

```bash
# Basic request
curl -H "x-api-key: your_key_here" \
  "https://gameawards.netlify.app/film-awards?imdb_id=tt0133093"

# Using query parameter for API key
curl "https://gameawards.netlify.app/film-awards?imdb_id=tt0133093&apikey=your_key_here"

# Using short alias
curl -H "x-api-key: your_key_here" \
  "https://gameawards.netlify.app/film-awards?i=tt15398776"
```

### JavaScript (Fetch)

```javascript
const response = await fetch(
  'https://gameawards.netlify.app/film-awards?imdb_id=tt0133093',
  {
    headers: {
      'x-api-key': 'your_key_here'
    }
  }
);

const data = await response.json();

if (response.ok) {
  console.log('Badges:', data.badges);
  console.log('Total wins:', data.stats.wins);
}
```

### Node.js

```javascript
const axios = require('axios');

async function getFilmAwards(imdbId) {
  try {
    const { data } = await axios.get(
      `https://gameawards.netlify.app/film-awards?imdb_id=${imdbId}`,
      {
        headers: {
          'x-api-key': process.env.AWARDS_API_KEY
        }
      }
    );
    return data;
  } catch (error) {
    console.error('Error fetching awards:', error.response?.data);
    throw error;
  }
}
```

## Response Fields

### Top Level

- `imdb_id` (string) - The requested IMDb identifier
- `nominations` (array) - All nominations grouped by ceremony
- `badges` (array) - Quick summary badges for UI display
- `stats` (object) - Aggregate statistics

### Nominations Object

- `ceremony` (string) - Full ceremony name (e.g., "96th Academy Awards")
- `year` (integer) - Year of the ceremony
- `organization` (string) - Awarding organization (e.g., "Academy Awards")
- `categories` (array) - Categories for this ceremony

### Category Object

- `category` (string) - Award category name (e.g., "Best Picture")
- `win` (boolean) - `true` if won, `false` if nominated only

### Stats Object

- `nominations` (integer) - Total number of nominations
- `wins` (integer) - Total number of wins

## Badges

Badges provide a quick summary for UI display:

- `"{Organization} Winner"` - Film won at least one award
- `"{Organization} Nominee"` - Film was nominated but did not win

Examples:
- "Academy Awards Winner"
- "Academy Awards Nominee"

## Rate Limits

Standard API rate limits apply:

- **Free tier**: 1,000 requests/day, 10,000 requests/month
- **Professional**: 10,000 requests/day, 100,000 requests/month
- **Enterprise**: Custom limits

Rate limit headers included in response:
- `X-RateLimit-Remaining-Daily`
- `X-RateLimit-Remaining-Monthly`
- `X-RateLimit-Tier`

## Local Development

```bash
# Start Netlify Dev
npm run netlify:dev

# Query endpoint (no API key required in dev)
curl "http://localhost:8888/film-awards?imdb_id=tt0133093"
```

## Data Coverage

### Current Coverage

- **Academy Awards (Oscars)**: Sample data (1999-2024)
  - Major categories: Picture, Director, Acting, Writing, Technical

### Planned Expansion

- Full historical Oscars data (1929-present)
- Golden Globes
- BAFTA Awards
- Screen Actors Guild (SAG)
- Critics Choice Awards

## Notes

- IMDb IDs must start with `tt` followed by at least 7 digits
- Nominations are ordered by year (most recent first)
- Categories within a ceremony are alphabetically sorted
- People associated with nominations are tracked but not currently returned in the API response
- The endpoint is idempotent and safe to cache

## Support

For API issues or questions:
- 📧 Email: support@awardsapi.com
- 📚 Main docs: [../README.md](../../README.md)

## Related Endpoints

- [Game Awards API](../README.md) - Board game awards data
- [API Key Generation](../../public/apikey.html) - Get your API key

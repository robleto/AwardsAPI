# Oscar (Academy Awards) API Documentation

Complete API access to comprehensive Academy Award nomination data from 1929-2025, including all nominees across 10 core categories.

## Base URL
```
https://gameawardsapi.netlify.app/.netlify/functions
```

## Authentication
All endpoints require an API key:
- **Header:** `x-api-key: YOUR_API_KEY`
- **Query:** `?apikey=YOUR_API_KEY`

Get your free API key: https://gameawardsapi.netlify.app/apikey

---

## Endpoints

### 1. Get Awards by Film (IMDb ID)

Retrieve all Oscar nominations and wins for a specific film.

**Endpoint:** `GET /film-awards`

**Parameters:**
- `imdb_id` (required): IMDb ID (e.g., `tt0111161`)
- `apikey` (required): Your API key

**Example Request:**
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/film-awards?imdb_id=tt0111161&apikey=YOUR_KEY"
```

**Example Response:**
```json
{
  "imdb_id": "tt0111161",
  "nominations": [
    {
      "ceremony_year": 1995,
      "ceremony_name": "67th Academy Awards",
      "category_name": "Best Picture",
      "is_win": false,
      "people": [
        { "name": "Niki Marvin", "role": "Producer" }
      ]
    },
    {
      "ceremony_year": 1995,
      "ceremony_name": "67th Academy Awards",
      "category_name": "Best Actor",
      "is_win": false,
      "people": [
        { "name": "Morgan Freeman", "role": "Actor" }
      ]
    }
  ],
  "badges": ["oscar_nominee"],
  "stats": {
    "nominations": 7,
    "wins": 0
  }
}
```

---

### 2. Browse/Search Oscars

Search and filter Oscar nominations by year, category, winner status, and more.

**Endpoint:** `GET /oscars`

**Parameters:**
- `year` (optional): Filter by ceremony year (e.g., `2024`)
- `category` (optional): Filter by category name (partial match, e.g., `"Best Picture"`, `"actor"`)
- `winner` (optional): Filter to winners only (`true` or `false`)
- `imdb_id` (optional): Filter by specific film IMDb ID
- `limit` (optional): Max results (default: 50, max: 500)
- `offset` (optional): Pagination offset (default: 0)
- `sort` (optional): Sort order
  - `year_desc` (default): Most recent first
  - `year_asc`: Oldest first
  - `category`: By category name
  - `film`: By film title
- `apikey` (required): Your API key

**Example Requests:**

Get all Best Picture winners:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscars?category=Best%20Picture&winner=true&apikey=YOUR_KEY"
```

Get all 2024 nominations:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscars?year=2024&apikey=YOUR_KEY"
```

Get Best Actor nominees from 2024:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscars?year=2024&category=Best%20Actor&apikey=YOUR_KEY"
```

**Example Response:**
```json
{
  "total": 10,
  "limit": 50,
  "offset": 0,
  "count": 10,
  "results": [
    {
      "ceremony_year": 2024,
      "ceremony_name": "96th Academy Awards",
      "category_name": "Best Picture",
      "imdb_id": "tt15398776",
      "film_title": "Oppenheimer",
      "is_win": true,
      "people": [
        { "name": "Emma Thomas", "role": "Producer" },
        { "name": "Christopher Nolan", "role": "Producer" },
        { "name": "Charles Roven", "role": "Producer" }
      ]
    }
  ],
  "filters": {
    "year": 2024,
    "category": "Best Picture",
    "winner_only": true
  }
}
```

---

### 3. Oscar Statistics & Metadata

Get statistics and insights about Oscar data.

**Endpoint:** `GET /oscar-stats`

**Parameters:**
- `type` (optional): Type of statistics to retrieve
  - `overview` (default): Overall statistics
  - `categories`: List all categories with counts
  - `years`: List all ceremony years with stats
  - `top_films`: Most nominated films
  - `top_people`: Most nominated people
- `year` (optional): Get stats for specific year
- `category` (optional): Get stats for specific category
- `role` (optional): Filter people by role (Actor, Director, etc.) - only with `type=top_people`
- `limit` (optional): Max results for top lists (default: 25, max: 100)
- `apikey` (required): Your API key

**Example Requests:**

Overall statistics:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscar-stats?apikey=YOUR_KEY"
```

**Response:**
```json
{
  "overview": {
    "total_ceremonies": 96,
    "first_year": 1929,
    "latest_year": 2025,
    "total_categories": 10,
    "total_films": 1873,
    "total_nominations": 3941,
    "total_wins": 886,
    "total_people": 2847
  },
  "data_quality": {
    "coverage": "1929-2025 (96 ceremonies)",
    "categories_tracked": [
      "Best Picture",
      "Best Director",
      "Best Actor",
      "Best Actress",
      "Best Supporting Actor",
      "Best Supporting Actress",
      "Best Original Screenplay",
      "Best Adapted Screenplay",
      "Best Animated Feature",
      "Lifetime Achievement"
    ],
    "note": "Includes all nominees, not just winners"
  }
}
```

List all categories:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscar-stats?type=categories&apikey=YOUR_KEY"
```

**Response:**
```json
{
  "categories": [
    {
      "category_name": "Best Picture",
      "total_nominations": 556,
      "total_wins": 96,
      "first_year": 1929,
      "latest_year": 2025,
      "ceremonies_count": 96
    },
    {
      "category_name": "Best Director",
      "total_nominations": 480,
      "total_wins": 96,
      "first_year": 1929,
      "latest_year": 2025,
      "ceremonies_count": 96
    }
  ]
}
```

Most nominated films:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscar-stats?type=top_films&limit=10&apikey=YOUR_KEY"
```

**Response:**
```json
{
  "films": [
    {
      "imdb_id": "tt0360717",
      "film_title": "The King's Speech",
      "total_nominations": 12,
      "total_wins": 4,
      "years": [2011],
      "categories": ["Best Picture", "Best Director", "Best Actor", ...]
    }
  ],
  "limit": 10
}
```

Most nominated actors:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscar-stats?type=top_people&role=actor&limit=20&apikey=YOUR_KEY"
```

Statistics for 2024:
```bash
curl "https://gameawardsapi.netlify.app/.netlify/functions/oscar-stats?year=2024&apikey=YOUR_KEY"
```

---

## Data Coverage

### Categories Included
1. **Best Picture** (5-10 nominees depending on year)
   - 1929-2009: 5 nominees
   - 2010-2011: 10 nominees
   - 2012-present: 8-10 nominees (variable based on voting)

2. **Best Director** (5 nominees)

3. **Best Actor** (5 nominees)

4. **Best Actress** (5 nominees)

5. **Best Supporting Actor** (5 nominees)

6. **Best Supporting Actress** (5 nominees)

7. **Best Original Screenplay** (5 nominees)

8. **Best Adapted Screenplay** (5 nominees)

9. **Best Animated Feature** (3-5 nominees)
   - 3 nominees: When 16-23 eligible films
   - 5 nominees: When 24+ eligible films
   - First awarded: 2002 (74th Academy Awards)

10. **Lifetime Achievement** (Honorary Awards, variable 1-3 per year)

### Historical Coverage
- **96 ceremonies** from 1929-2025
- **3,941 nominations** across all categories
- **1,873 unique films**
- **886 wins**
- Complete nominee lists (not just winners)
- IMDb IDs for film cross-referencing
- Person credits (actors, directors, writers, producers)

---

## Response Format

### Success Response
All successful responses include:
- HTTP Status: `200`
- Content-Type: `application/json`

### Error Response
```json
{
  "error": "Error description",
  "allowed_domains": ["film"]
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Missing API key
- `403`: Invalid domain (key not authorized for film data)
- `404`: No results found
- `429`: Rate limit exceeded
- `500`: Internal server error

---

## Rate Limits

| Tier | Daily Limit | Monthly Limit | Cost |
|------|-------------|---------------|------|
| Free | 100 | 1,000 | $0 |
| Hobby | 1,000 | 10,000 | $9/mo |
| Pro | 10,000 | 100,000 | $29/mo |
| Business | 100,000 | 1,000,000 | $99/mo |

---

## Best Practices

### Caching
Cache responses for at least 24 hours. Oscar data is historical and rarely changes.

```javascript
// Example with React Query
const { data } = useQuery({
  queryKey: ['film-awards', imdbId],
  queryFn: () => fetchFilmAwards(imdbId),
  staleTime: 1000 * 60 * 60 * 24 // 24 hours
});
```

### Pagination
For large result sets, use `limit` and `offset`:

```bash
# First page (results 0-49)
/oscars?category=Best Picture&limit=50&offset=0

# Second page (results 50-99)
/oscars?category=Best Picture&limit=50&offset=50
```

### Partial Category Matching
The `category` parameter supports partial matching:

```bash
# Matches all actor categories (Actor, Actress, Supporting Actor, Supporting Actress)
/oscars?category=actor

# Matches both screenplay categories
/oscars?category=screenplay
```

### Error Handling
Always handle errors gracefully:

```javascript
try {
  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    console.error('API Error:', error.error);
  }
  const data = await response.json();
} catch (err) {
  console.error('Network error:', err);
}
```

---

## Integration Examples

### React Component
```jsx
import { useQuery } from '@tanstack/react-query';

function OscarBadge({ imdbId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['oscars', imdbId],
    queryFn: async () => {
      const res = await fetch(
        `/.netlify/functions/film-awards?imdb_id=${imdbId}&apikey=${API_KEY}`
      );
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24
  });

  if (isLoading) return null;
  if (!data?.nominations?.length) return null;

  const wins = data.stats.wins;
  const noms = data.stats.nominations;

  return (
    <div className="oscar-badge">
      {wins > 0 && <span>🏆 {wins} Oscar Win{wins > 1 ? 's' : ''}</span>}
      {noms > wins && <span>📽️ {noms - wins} Nomination{noms - wins > 1 ? 's' : ''}</span>}
    </div>
  );
}
```

### Node.js/Express
```javascript
const express = require('express');
const fetch = require('node-fetch');

app.get('/movie/:imdbId/awards', async (req, res) => {
  try {
    const response = await fetch(
      `https://gameawardsapi.netlify.app/.netlify/functions/film-awards?imdb_id=${req.params.imdbId}&apikey=${process.env.GAME_AWARDS_API_KEY}`
    );
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch awards' });
  }
});
```

### Python
```python
import requests
from functools import lru_cache

@lru_cache(maxsize=1000)
def get_film_awards(imdb_id: str) -> dict:
    url = f"https://gameawardsapi.netlify.app/.netlify/functions/film-awards"
    params = {
        'imdb_id': imdb_id,
        'apikey': os.environ['GAME_AWARDS_API_KEY']
    }
    response = requests.get(url, params=params)
    response.raise_for_status()
    return response.json()

# Usage
awards = get_film_awards('tt0111161')
print(f"Nominations: {awards['stats']['nominations']}")
print(f"Wins: {awards['stats']['wins']}")
```

---

## Support

- **Documentation:** https://gameawardsapi.netlify.app/docs
- **API Key:** https://gameawardsapi.netlify.app/apikey
- **Issues:** Open an issue on GitHub
- **Email:** support@gameawardsapi.com

---

## License

Data provided under Commercial License. See [LICENSE-COMMERCIAL.md](../LICENSE-COMMERCIAL.md) for terms.

For Reawarding App: See [LICENSE-REAWARDING-APP.md](../LICENSE-REAWARDING-APP.md) for complementary license terms.

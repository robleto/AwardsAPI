# Film Awards API

Endpoint for retrieving awards (multiple organizations) for a film by IMDb ID. Supports organization filtering and includes a sources list of organizations present in the response.


- Endpoint: `GET /.netlify/functions/film-awards`
- Auth: `x-api-key` header or `apikey` query param


Parameters


- `imdb_id` (required): IMDb ID (e.g., `tt0053291`)
- `organization` (optional): Comma-separated organizations or aliases to filter results
  - Aliases: `oscars` → `Academy Awards`, `golden globes|globes` → `Golden Globes`
  - Pre-wired: `bafta` → `British Academy Film Awards`, `sag` → `Screen Actors Guild Awards`
- `apikey` (required): Your API key (or use `x-api-key` header)


Examples


Get all awards (all orgs):

```bash
curl \
  "/.netlify/functions/film-awards?imdb_id=tt0053291&apikey=YOUR_KEY"
```

Golden Globes only:

```bash
curl \
  "/.netlify/functions/film-awards?imdb_id=tt0053291&organization=golden%20globes&apikey=YOUR_KEY"
```

Oscars + Globes:

```bash
curl \
  "/.netlify/functions/film-awards?imdb_id=tt0053291&organization=oscars,globes&apikey=YOUR_KEY"
```

Response

```json
{
  "imdb_id": "tt0053291",
  "nominations": [
    {
      "year": 1960,
      "ceremony": "Golden Globes 1960",
      "organization": "Golden Globes",
      "categories": [
        { "category": "Actress In A Leading Role - Musical Or Comedy", "win": true },
        { "category": "Best Performance by an Actor in a Motion Picture - Musical or Comedy", "win": true }
      ]
    }
  ],
  "badges": ["Golden Globes Winner", "Academy Awards Nominee"],
  "stats": { "nominations": 5, "wins": 2 },
  "sources": ["Academy Awards", "Golden Globes"]
}
```

Notes


- Organization names in `sources` reflect what is returned after filtering.
- If filtering removes all nominations, response is `404` with `{ error, imdb_id }`.
- Rate limits and authentication are enforced per your key’s tier and domain access.

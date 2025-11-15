## Quick Start

```bash
git clone <your-private-repo>
cd AwardsAPI
cp .env.example .env  # fill DATABASE_URL + Stripe keys
npm install
netlify dev           # local serverless + static
# or
npm run dev           # express only
```

Request a key (demo path):
```bash
curl 'http://localhost:8888/.netlify/functions/generate-key' -X POST -H 'Content-Type: application/json' \
	-d '{"email":"demo@example.com","name":"Demo User"}'
```

Search:
```bash
curl 'http://localhost:8888/api?s=wingspan&apikey=demo'
```

Deploy: push to main → Netlify build triggers.

End.
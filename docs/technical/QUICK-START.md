## Quick Start

```bash
git clone <your-private-repo>
cd GameAwardsAPI
cp .env.example .env  # fill DATABASE_URL + Stripe keys
npm install
npm run dev           # express only
```

Search:
```bash
curl 'http://localhost:3000/api?s=wingspan'
```

Deploy: push to main → Netlify build triggers.

End.

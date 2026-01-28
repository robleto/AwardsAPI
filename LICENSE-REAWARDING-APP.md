# Complementary License for Reawarding App

**Effective Date:** November 14, 2025  
**Licensor:** Game Awards API (Greg Robleto)  
**Licensee:** Reawarding App (Greg Robleto)

---

## 1. Purpose & Grant

This Complementary License grants **Reawarding App** a special, perpetual, royalty-free right to access and utilize the **Game Awards API** (including all film, game, and future award data domains) under the following terms:

### 1.1 Scope of Grant
- **Unlimited API Access**: Reawarding App may make unlimited API requests across all domains (games, film, and any future domains) without rate limits, API key restrictions, or usage fees.
- **Data Display & Integration**: Full permission to display, cache, transform, and integrate API data within the Reawarding App user interface and features.
- **Commercial Use**: This grant covers both free and paid versions of Reawarding App, including subscription tiers, premium features, and in-app purchases.

### 1.2 What This License Does NOT Grant
- **Bulk Redistribution**: Reawarding App may NOT resell, sublicense, or provide bulk database exports to third parties.
- **Standalone Data Products**: May NOT create derivative datasets or APIs that compete with Game Awards API.
- **Code Repository Access**: This license covers API usage only, not redistribution of the Game Awards API source code.

---

## 2. Technical Terms

### 2.1 API Key Management
- Reawarding App will use a designated "internal" or "partner" tier API key with unlimited quota.
- Rate limiting will be disabled for Reawarding App API keys.
- Multiple API keys may be issued for development, staging, and production environments.

### 2.2 Data Freshness & Updates
- Reawarding App may cache API responses for up to **30 days** for performance optimization.
- When Game Awards API data is updated (new ceremonies, corrections), Reawarding App should refresh cached data within a reasonable timeframe (suggested: weekly sync).

### 2.3 Attribution
- Reawarding App must include attribution to **"Game Awards API"** in its app settings, about page, or credits section.
- Suggested format: _"Award data provided by Game Awards API"_
- Attribution must include a link to the API documentation or homepage when displayed in web contexts.

---

## 3. Domains Covered

This license explicitly covers access to the following Game Awards API domains:

### 3.1 Current Domains
- **Games Domain** (`domain: 'games'`): Board game awards (Spiel des Jahres, etc.)
- **Film Domain** (`domain: 'film'`): Academy Awards (Oscars), with comprehensive nomination data including:
  - Best Picture (variable 5-10 nominees)
  - Acting categories (Actor, Actress, Supporting Actor, Supporting Actress)
  - Director, Screenplay (Original & Adapted)
  - Animated Feature (3-5 nominees depending on eligibility)
  - Lifetime Achievement (Honorary Awards)
  - All historical data from 1929-2025 (96 ceremonies, 3,941 nominations, 1,873 films)

### 3.2 Future Domains
Any additional domains added to Game Awards API in the future (e.g., music, television, sports) will automatically be covered under this license unless explicitly excluded by written amendment.

---

## 4. Responsibilities & Best Practices

### 4.1 Reawarding App Responsibilities
- **Accuracy**: Display award data accurately and in context (e.g., distinguish nominees from winners).
- **Corrections**: Report any data errors discovered to Game Awards API for correction.
- **No Misrepresentation**: Do not claim ownership of the award data or misrepresent its source.
- **Security**: Keep API keys secure and do not expose them in client-side code or public repositories.

### 4.2 Game Awards API Responsibilities
- **Uptime**: Maintain reasonable API availability (target: 99% uptime).
- **Data Quality**: Provide accurate, comprehensive award data with proper IMDb IDs, film titles, and nominee information.
- **Advance Notice**: Provide at least 30 days notice of any breaking API changes that affect Reawarding App integration.
- **Support**: Provide priority support for technical issues affecting Reawarding App.

---

## 5. Data Usage Examples (Permitted)

The following uses are explicitly permitted under this license:

### 5.1 Display Features
- Show film award badges/icons on movie detail pages
- Display "Academy Award Winner" or "Oscar Nominee" labels
- List all nominations for a specific film with category details
- Create award timeline visualizations
- Show statistics (e.g., "3 wins, 7 nominations")

### 5.2 Search & Discovery
- Filter movies by award status (winners, nominees)
- Search by category (e.g., "Best Picture winners 2020-2024")
- Sort by number of nominations/wins
- Create curated lists based on award data

### 5.3 User Features
- Allow users to track/favorite award-winning films
- Generate personalized recommendations based on Oscar history
- Create challenges/achievements (e.g., "Watch 10 Best Picture winners")
- Social sharing of award-related content

### 5.4 Analytics & Insights
- Aggregate statistics about user preferences for award winners
- Internal analytics on which award categories drive engagement
- A/B testing of award data presentation formats

---

## 6. Prohibited Uses

The following uses are explicitly prohibited:

### 6.1 Competing Products
- Creating a separate "Oscar Database API" or similar competing service
- Selling award data access to third-party developers
- Providing bulk CSV/JSON exports of the award database

### 6.2 Data Integrity
- Fabricating or altering award data (must use data as-is from API)
- Mixing award data with unofficial or speculative awards
- Removing or obscuring required attribution

### 6.3 Malicious Activity
- Deliberately overloading the API infrastructure
- Reverse engineering to extract the full database
- Sharing API keys with unauthorized parties

---

## 7. Term & Termination

### 7.1 Term
This license is **perpetual** and remains in effect as long as both Game Awards API and Reawarding App are maintained by the same entity/owner (Greg Robleto) or successors acting in good faith.

### 7.2 Termination Conditions
This license may only be terminated under the following circumstances:

- **Mutual Agreement**: Both parties agree in writing to terminate.
- **Material Breach**: Reawarding App commits a material breach (e.g., bulk resale of data) and fails to cure within 30 days of written notice.
- **Change of Control**: If Reawarding App is sold/transferred to a third party without prior written consent from Game Awards API.

### 7.3 Effect of Termination
Upon termination:
- API access for Reawarding App API keys will be revoked within 7 days.
- Reawarding App must remove cached award data within 30 days.
- Attribution requirements remain in effect for any historical content.

---

## 8. Warranty & Liability

### 8.1 Data Accuracy Disclaimer
Award data is provided **"AS IS"** with reasonable efforts toward accuracy. Game Awards API makes no warranty that data is 100% error-free, though corrections will be made when errors are identified.

### 8.2 Service Availability
While target uptime is 99%, there is **no guarantee** of uninterrupted service. Reawarding App should implement graceful fallbacks for API unavailability.

### 8.3 Limitation of Liability
Game Awards API's total liability for any claims arising from this license is limited to **$0** (zero dollars), reflecting the royalty-free nature of this agreement. Both parties release each other from consequential damages, lost profits, or indirect harm.

---

## 9. Updates & Amendments

### 9.1 License Updates
Game Awards API may update these terms with 30 days notice. Reawarding App's continued use after the notice period constitutes acceptance.

### 9.2 API Version Changes
Major API version changes (e.g., v1 → v2) will maintain backward compatibility for at least 12 months, or a migration path will be provided.

### 9.3 Domain Additions
New domains are automatically covered unless explicitly excluded. Exclusions require written amendment signed by both parties.

---

## 10. Special Provisions

### 10.1 Common Ownership Clause
This license acknowledges that Game Awards API and Reawarding App share common ownership (Greg Robleto). In the event of separate ownership:
- This license converts to a standard commercial partnership agreement with terms to be negotiated in good faith.
- Existing integrations remain valid during a 90-day transition period.

### 10.2 Open Source Exception
If Game Awards API transitions to an open-source license (e.g., MIT), this complementary license is superseded by the open-source terms, which may be more permissive.

### 10.3 Priority Support
Reawarding App receives priority for:
- Bug fixes affecting API functionality
- Feature requests that benefit both projects
- Technical support inquiries (target: 24-hour response time)

---

## 11. Contact & Governance

**Primary Contact:**  
Greg Robleto  
Email: greg@gameawardsapi.com  

**Dispute Resolution:**  
Any disputes will be resolved through good-faith negotiation. If negotiation fails, disputes will be resolved through binding arbitration in accordance with the laws of [Your Jurisdiction].

**Amendment Process:**  
Amendments require written agreement (email acceptable) from both parties.

---

## 12. Acceptance

By integrating Game Awards API into Reawarding App, the licensee acknowledges acceptance of these terms.

**Licensor:**  
Game Awards API  
By: Greg Robleto  
Date: November 14, 2025

**Licensee:**  
Reawarding App  
By: Greg Robleto  
Date: November 14, 2025

---

**END OF LICENSE**

---

## Appendix A: Technical Integration Guide

### Current API Endpoints for Reawarding App

#### Film Awards Endpoints

```bash
# Get all awards for a specific film by IMDb ID
GET /.netlify/functions/film-awards?imdb_id=tt0111161&apikey={YOUR_KEY}

# Response includes:
{
  "imdb_id": "tt0111161",
  "nominations": [
    {
      "ceremony_year": 1995,
      "ceremony_name": "67th Academy Awards",
      "category_name": "Best Picture",
      "is_win": false,
      "people": [...]
    }
  ],
  "badges": ["oscar_nominee"],
  "stats": {
    "nominations": 7,
    "wins": 0
  }
}
```

#### Search Oscars by Year/Category
(To be implemented - see recommendations below)

```bash
# Get all Best Picture winners
GET /.netlify/functions/oscars?category=Best Picture&winner=true

# Get all nominations for a specific year
GET /.netlify/functions/oscars?year=2024

# Get acting winners across all years
GET /.netlify/functions/oscars?category=actor&winner=true
```

### Recommended Integration Pattern

```javascript
// Example React hook for Reawarding App
import { useQuery } from '@tanstack/react-query';

const REAWARDING_API_KEY = process.env.GAME_AWARDS_API_KEY;

export function useFilmAwards(imdbId) {
  return useQuery({
    queryKey: ['film-awards', imdbId],
    queryFn: async () => {
      const res = await fetch(
        `/.netlify/functions/film-awards?imdb_id=${imdbId}&apikey=${REAWARDING_API_KEY}`
      );
      if (!res.ok) throw new Error('Failed to fetch awards');
      return res.json();
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hour cache
    enabled: !!imdbId
  });
}
```

---

_This complementary license is designed to provide legal clarity and technical guidance for the integrated use of Game Awards API within Reawarding App while protecting the interests of both projects._

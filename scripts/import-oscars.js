'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../config/database');

/*
Expected JSON input: array of records like
[
  {
    "ceremony_year": 2024,
    "org_name": "Academy Awards",
    "ceremony_name": "Oscars 2024",
    "category_name": "Best Picture",
    "imdb_id": "tt1517268",
    "film_title": "Barbie",
    "is_win": false,
    "people": [ { "name": "Greta Gerwig", "role": "Director" } ]
  }
]
*/

async function upsert(sql, text, params) {
  return await sql(text, params);
}

async function importRecords(records) {
  const sql = db.init();

  for (const r of records) {
    const year = r.ceremony_year;
    const org = r.org_name || 'Academy Awards';
    const cerName = r.ceremony_name || `Oscars ${year}`;

    const [cer] = await sql`
      INSERT INTO ceremonies (domain, organization, name, year)
      VALUES ('film', ${org}, ${cerName}, ${year})
      ON CONFLICT (domain, organization, year)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `;

    const ceremonyId = cer.id;

    const [cat] = await sql`
      INSERT INTO award_categories (ceremony_id, name)
      VALUES (${ceremonyId}, ${r.category_name})
      ON CONFLICT (ceremony_id, name)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id
    `;

    const categoryId = cat.id;

    const [nom] = await sql`
      INSERT INTO nominations (category_id, imdb_id, title, is_win)
      VALUES (${categoryId}, ${r.imdb_id}, ${r.film_title}, ${!!r.is_win})
      ON CONFLICT (category_id, imdb_id)
      DO UPDATE SET title = EXCLUDED.title, is_win = EXCLUDED.is_win, updated_at = now()
      RETURNING id
    `;

    const nominationId = nom.id;
    const people = r.people || [];

    for (const p of people) {
      const [person] = await sql`
        INSERT INTO people (name)
        VALUES (${p.name})
        ON CONFLICT (name)
        DO UPDATE SET name = EXCLUDED.name, updated_at = now()
        RETURNING id
      `;

      await sql`
        INSERT INTO nomination_people (nomination_id, person_id, role)
        VALUES (${nominationId}, ${person.id}, ${p.role || null})
        ON CONFLICT (nomination_id, person_id, role) DO NOTHING
      `;
    }
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/import-oscars.js path/to/oscars.json');
    process.exit(1);
  }
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const data = JSON.parse(raw);
  await importRecords(Array.isArray(data) ? data : data.records || []);
  console.log('Import complete:', Array.isArray(data) ? data.length : (data.records||[]).length, 'records');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

'use strict';

// Import Golden Globes CSV into Neon film schema
// - Maps film titles to IMDb IDs using Oscars datasets, then OMDb if available
// - Upserts ceremonies, categories, people, nominations, and nomination_people

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const axios = require('axios');
const db = require('../config/database');

function normalizeTitle(t) {
  return (t || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadOscarsMaps() {
  const maps = { byTitle: new Map(), byTitleYear: new Map() };
  // Load oscars_complete.json if present
  const oscarsFile = path.resolve(__dirname, '..', 'data', 'oscars_complete.json');
  const loadRows = (rows) => {
    for (const row of rows) {
      const titleNorm = normalizeTitle(row.film_title || row.title || row.movie || '');
      const imdbId = row.imdb_id || row.imdbID || row.imdb;
      if (titleNorm && imdbId) {
        if (!maps.byTitle.has(titleNorm)) maps.byTitle.set(titleNorm, imdbId);
        const cy = row.ceremony_year || row.year || row.award_year || row.release_year;
        if (cy) {
          const key = `${titleNorm}|${cy}`;
          if (!maps.byTitleYear.has(key)) maps.byTitleYear.set(key, imdbId);
        }
      }
    }
  };
  if (fs.existsSync(oscarsFile)) {
    loadRows(JSON.parse(fs.readFileSync(oscarsFile, 'utf8')));
  }
  // Also load any oscars_* JSONs (including comprehensive decades) to improve coverage
  const dataDir = path.resolve(__dirname, '..', 'data');
  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter(f => f.startsWith('oscars_') && f.endsWith('.json') && f !== 'oscars_complete.json');
    for (const f of files) {
      try {
        const rows = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
        if (Array.isArray(rows)) loadRows(rows);
      } catch (_) {
        // skip invalid
      }
    }
  }
  return maps;
}

async function lookupImdbId(title, yearFilm, maps, omdbKey) {
  const titleNorm = normalizeTitle(title);
  if (!titleNorm) return null;

  // 1) Exact title+awardYear (proxy) match via Oscars map
  if (yearFilm) {
    const k = `${titleNorm}|${yearFilm}`;
    if (maps.byTitleYear.has(k)) return maps.byTitleYear.get(k);
  }

  // 2) Title-only match via Oscars map
  if (maps.byTitle.has(titleNorm)) return maps.byTitle.get(titleNorm);

  // 3) OMDb lookup if configured
  if (omdbKey) {
    try {
      const params = { apikey: omdbKey, t: title };
      if (yearFilm) params.y = String(yearFilm);
      params.type = 'movie';
      const resp = await axios.get('http://www.omdbapi.com/', { params });
      if (resp.data && resp.data.imdbID && resp.data.imdbID.startsWith('tt')) {
        return resp.data.imdbID;
      }
    } catch (e) {
      // ignore and fall through
    }
  }

  return null;
}

function isTelevisionCategory(category) {
  const c = (category || '').toLowerCase();
  return (
    c.includes('television') ||
    c.includes('tv ') || c.includes(' tv') || c.includes(' tv ') ||
    c.includes('series') ||
    c.includes('program') ||
    c.includes('producer/director') // historical TV combo categories
  );
}

function inferRoleFromCategory(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('actress')) return 'Actress';
  if (c.includes('actor')) return 'Actor';
  if (c.includes('director')) return 'Director';
  if (c.includes('screenplay')) return 'Writer';
  if (c.includes('score')) return 'Composer';
  if (c.includes('song')) return 'Song';
  if (c.includes('cinematography')) return 'Cinematography';
  return null;
}

async function upsertCeremony(sql, organization, year) {
  const name = `${organization} ${year}`;
  const rows = await sql`
    INSERT INTO ceremonies (domain, organization, name, year)
    VALUES ('film', ${organization}, ${name}, ${year})
    ON CONFLICT (domain, organization, year)
    DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    RETURNING id
  `;
  return rows[0].id;
}

async function upsertCategory(sql, ceremonyId, name) {
  const rows = await sql`
    INSERT INTO award_categories (ceremony_id, name)
    VALUES (${ceremonyId}, ${name})
    ON CONFLICT (ceremony_id, name)
    DO UPDATE SET updated_at = NOW()
    RETURNING id
  `;
  return rows[0].id;
}

async function upsertPerson(sql, name) {
  const rows = await sql`
    INSERT INTO people (name)
    VALUES (${name})
    ON CONFLICT (name)
    DO UPDATE SET updated_at = NOW()
    RETURNING id
  `;
  return rows[0].id;
}

async function upsertNomination(sql, categoryId, imdbId, title, isWin) {
  const rows = await sql`
    INSERT INTO nominations (category_id, imdb_id, title, is_win)
    VALUES (${categoryId}, ${imdbId}, ${title}, ${isWin})
    ON CONFLICT (category_id, imdb_id)
    DO UPDATE SET is_win = nominations.is_win OR EXCLUDED.is_win, updated_at = NOW()
    RETURNING id
  `;
  return rows[0].id;
}

async function linkNominationPerson(sql, nominationId, personId, role) {
  await sql`
    INSERT INTO nomination_people (nomination_id, person_id, role)
    VALUES (${nominationId}, ${personId}, ${role})
    ON CONFLICT (nomination_id, person_id, role)
    DO NOTHING
  `;
}

async function main() {
  const csvPath = path.resolve(__dirname, '..', 'data', 'golden_globe_awards.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('CSV not found at', csvPath);
    process.exit(1);
  }

  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const limitArg = Array.from(args).find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const omdbKey = process.env.OMDB_API_KEY || process.env.OMDBKEY || process.env.OMDB;

  const maps = loadOscarsMaps();
  const sql = db.init();

  if (!args.has('--skip-normalize')) {
    // Cleanup any prior category names with odd whitespace (e.g., from earlier imports)
    await sql`
      UPDATE award_categories ac
      SET name = regexp_replace(trim(ac.name), '\\s+', ' ', 'g'), updated_at = NOW()
      FROM ceremonies ce
      WHERE ac.ceremony_id = ce.id AND ce.organization = 'Golden Globes'
    `;
  }

  const org = 'Golden Globes';

  const parser = fs
    .createReadStream(csvPath)
    .pipe(parse({ columns: true, skip_empty_lines: true, relax_quotes: true }));

  let processed = 0;
  let imported = 0;
  let skippedTv = 0;
  let skippedNoImdb = 0;
  let errors = 0;

  for await (const row of parser) {
    if (limit && processed >= limit) break;
    processed++;

    const yearFilm = row.year_film ? parseInt(row.year_film, 10) : undefined;
    const yearAward = row.year_award ? parseInt(row.year_award, 10) : undefined;
    const category = (row.category || '').replace(/\s+/g, ' ').trim();
    const nominee = (row.nominee || '').replace(/\s+/g, ' ').trim();
    const filmTitle = (row.film || '').replace(/\s+/g, ' ').trim();
    const isWin = String(row.win).toLowerCase() === 'true';

    // Basic filters
    if (!filmTitle) continue; // some rows are person-only or non-film items
    if (isTelevisionCategory(category)) { skippedTv++; continue; }

    let imdbId = await lookupImdbId(filmTitle, yearFilm, maps, omdbKey);
    if (!imdbId) { skippedNoImdb++; continue; }

    try {
      if (dryRun) {
        imported++;
        continue;
      }

      const ceremonyId = await upsertCeremony(sql, org, yearAward || yearFilm || null);
      const categoryId = await upsertCategory(sql, ceremonyId, category || 'Unknown Category');
      const nominationId = await upsertNomination(sql, categoryId, imdbId, filmTitle, isWin);

      if (nominee) {
        const personId = await upsertPerson(sql, nominee);
        const role = inferRoleFromCategory(category) || null;
        await linkNominationPerson(sql, nominationId, personId, role);
      }
      imported++;
    } catch (e) {
      errors++;
      if (process.env.DEBUG) {
        console.error('Error importing row', e?.message, { title: filmTitle, category, yearAward });
      }
    }
  }

  console.log(JSON.stringify({ processed, imported, skippedTv, skippedNoImdb, errors }, null, 2));
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

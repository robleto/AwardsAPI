#!/usr/bin/env node
'use strict';

/**
 * Normalize film award category names by collapsing whitespace/newlines to single spaces
 * - Targets `award_categories.name` joined via `ceremonies` in domain 'film'
 * - Supports alias org filters: oscars, globes/golden globes, bafta, sag
 * - Flags: --dry-run (reports counts only), --org=oscars,globes (optional)
 */

const db = require('../config/database');

const ORG_ALIASES = new Map([
  ['oscars', 'Academy Awards'],
  ['academy awards', 'Academy Awards'],
  ['globes', 'Golden Globes'],
  ['golden globes', 'Golden Globes'],
  ['bafta', 'British Academy Film Awards'],
  ['sag', 'Screen Actors Guild Awards']
]);

function parseArgs(argv) {
  const args = new Set(argv);
  const dryRun = args.has('--dry-run');
  const orgArg = Array.from(argv).find(a => a.startsWith('--org='));
  let orgs = null;
  if (orgArg) {
    const raw = orgArg.split('=')[1];
    orgs = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean).map(o => ORG_ALIASES.get(o) || o);
  }
  return { dryRun, orgs };
}

async function normalizeForOrg(sql, organization, dryRun) {
  if (dryRun) {
    const rows = await sql`
      SELECT count(*)::int AS to_update
      FROM award_categories ac
      JOIN ceremonies ce ON ce.id = ac.ceremony_id
      WHERE ce.domain = 'film'
        AND ce.organization = ${organization}
        AND ac.name <> regexp_replace(trim(ac.name), '\\s+', ' ', 'g')
    `;
    return { organization, updated: rows[0]?.to_update || 0 };
  }

  const updated = await sql`
    WITH updated AS (
      UPDATE award_categories ac
      SET name = regexp_replace(trim(ac.name), '\\s+', ' ', 'g'), updated_at = NOW()
      FROM ceremonies ce
      WHERE ce.id = ac.ceremony_id
        AND ce.domain = 'film'
        AND ce.organization = ${organization}
        AND ac.name <> regexp_replace(trim(ac.name), '\\s+', ' ', 'g')
      RETURNING ac.id
    )
    SELECT count(*)::int AS updated FROM updated
  `;
  return { organization, updated: updated[0]?.updated || 0 };
}

async function normalizeAll(sql, dryRun) {
  if (dryRun) {
    const rows = await sql`
      SELECT count(*)::int AS to_update
      FROM award_categories ac
      JOIN ceremonies ce ON ce.id = ac.ceremony_id
      WHERE ce.domain = 'film'
        AND ac.name <> regexp_replace(trim(ac.name), '\\s+', ' ', 'g')
    `;
    return { scope: 'all', updated: rows[0]?.to_update || 0 };
  }

  const updated = await sql`
    WITH updated AS (
      UPDATE award_categories ac
      SET name = regexp_replace(trim(ac.name), '\\s+', ' ', 'g'), updated_at = NOW()
      FROM ceremonies ce
      WHERE ce.id = ac.ceremony_id
        AND ce.domain = 'film'
        AND ac.name <> regexp_replace(trim(ac.name), '\\s+', ' ', 'g')
      RETURNING ac.id
    )
    SELECT count(*)::int AS updated FROM updated
  `;
  return { scope: 'all', updated: updated[0]?.updated || 0 };
}

async function main() {
  const { dryRun, orgs } = parseArgs(process.argv.slice(2));
  const sql = db.init();

  let result = null;
  if (orgs && orgs.length > 0) {
    const perOrg = [];
    for (const org of orgs) {
      perOrg.push(await normalizeForOrg(sql, org, dryRun));
    }
    result = { scope: 'orgs', dryRun, results: perOrg };
  } else {
    result = { dryRun, result: await normalizeAll(sql, dryRun) };
  }

  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('Normalization error:', err.message);
    process.exit(1);
  });
}

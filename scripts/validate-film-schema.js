#!/usr/bin/env node
'use strict';

/**
 * Validate film awards schema migration
 * Checks that all tables, views, and functions exist after migration
 */

const db = require('../config/database');

const checks = [
  {
    name: 'Table: ceremonies',
    query: `SELECT to_regclass('public.ceremonies') as result`
  },
  {
    name: 'Table: award_categories',
    query: `SELECT to_regclass('public.award_categories') as result`
  },
  {
    name: 'Table: people',
    query: `SELECT to_regclass('public.people') as result`
  },
  {
    name: 'Table: nominations',
    query: `SELECT to_regclass('public.nominations') as result`
  },
  {
    name: 'Table: nomination_people',
    query: `SELECT to_regclass('public.nomination_people') as result`
  },
  {
    name: 'View: film_nominations',
    query: `SELECT to_regclass('public.film_nominations') as result`
  },
  {
    name: 'Function: get_film_awards_by_imdb',
    query: `SELECT exists(SELECT 1 FROM pg_proc WHERE proname = 'get_film_awards_by_imdb') as result`
  },
  {
    name: 'Function: get_film_award_badges_by_imdb',
    query: `SELECT exists(SELECT 1 FROM pg_proc WHERE proname = 'get_film_award_badges_by_imdb') as result`
  }
];

async function validate() {
  console.log('🔍 Validating film awards schema migration...\n');
  
  const sql = db.init();
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    try {
      const result = await sql.unsafe(check.query);
      const exists = result?.[0]?.result;
      
      if (exists === 'public.ceremonies' || exists === 'public.award_categories' || 
          exists === 'public.people' || exists === 'public.nominations' || 
          exists === 'public.nomination_people' || exists === 'public.film_nominations' ||
          exists === true) {
        console.log(`✅ ${check.name}`);
        passed++;
      } else {
        console.log(`❌ ${check.name} - NOT FOUND`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ${check.name} - ERROR: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Migration not complete. Run:');
    console.log('   psql "$DATABASE_URL" -f neon/20251113_awards_film_schema.sql');
    process.exit(1);
  } else {
    console.log('\n✨ Migration validated successfully!');
    process.exit(0);
  }
}

validate().catch(err => {
  console.error('💥 Validation error:', err.message);
  process.exit(1);
});

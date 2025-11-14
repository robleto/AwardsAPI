#!/usr/bin/env node
'use strict';

/**
 * Query film awards by IMDb ID
 * Usage: node scripts/query-film-awards.js tt0133093
 */

const db = require('../config/database');

async function queryFilmAwards(imdbId) {
  if (!imdbId || !/^tt\d{7,}$/.test(imdbId)) {
    console.error('❌ Invalid IMDb ID. Must be format: tt0133093');
    process.exit(1);
  }

  try {
    const sql = db.init();
    
    console.log(`🎬 Querying awards for IMDb ID: ${imdbId}\n`);

    // Get full awards data
    const dataResult = await sql`SELECT get_film_awards_by_imdb(${imdbId}) AS data`;
    const data = dataResult?.[0]?.data;

    // Get badges
    const badgesResult = await sql`SELECT get_film_award_badges_by_imdb(${imdbId}) AS badges`;
    const badges = badgesResult?.[0]?.badges || [];

    if (!data || !data.nominations || data.nominations.length === 0) {
      console.log('ℹ️  No awards found for this film.\n');
      return;
    }

    // Display badges
    console.log('🏆 Badges:');
    badges.forEach(badge => console.log(`   • ${badge}`));
    console.log('');

    // Display stats
    console.log('📊 Statistics:');
    console.log(`   Nominations: ${data.stats.nominations}`);
    console.log(`   Wins: ${data.stats.wins}`);
    console.log('');

    // Display nominations by ceremony
    console.log('🎭 Nominations by Ceremony:\n');
    data.nominations.forEach(nom => {
      console.log(`${nom.year} - ${nom.ceremony}`);
      console.log(`Organization: ${nom.organization}`);
      nom.categories.forEach(cat => {
        const status = cat.win ? '🏆 WIN' : '📝 NOMINATED';
        console.log(`   ${status} - ${cat.category}`);
      });
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error querying film awards:', error.message);
    process.exit(1);
  }
}

// Main
const imdbId = process.argv[2];
if (!imdbId) {
  console.log('Usage: node scripts/query-film-awards.js <imdb_id>');
  console.log('Example: node scripts/query-film-awards.js tt0133093');
  process.exit(1);
}

queryFilmAwards(imdbId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

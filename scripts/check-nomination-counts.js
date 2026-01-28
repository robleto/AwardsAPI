#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkNominations() {
  const client = await pool.connect();
  try {
    // Check Best Picture counts by year
    console.log('📊 BEST PICTURE NOMINEES BY YEAR:\n');
    const pictureResult = await client.query(`
      SELECT 
        c.year,
        COUNT(*) as nominees
      FROM nominations n
      JOIN award_categories ac ON ac.id = n.category_id
      JOIN ceremonies c ON c.id = ac.ceremony_id
      WHERE ac.name = 'Best Picture'
      GROUP BY c.year
      ORDER BY c.year DESC
      LIMIT 20
    `);
    pictureResult.rows.forEach(r => {
      const emoji = r.nominees > 5 ? '📈' : r.nominees < 5 ? '⚠️' : '✅';
      console.log(`  ${emoji} ${r.year}: ${r.nominees} nominees`);
    });

    // Check Best Animated Feature counts
    console.log('\n🎨 BEST ANIMATED FEATURE NOMINEES BY YEAR:\n');
    const animatedResult = await client.query(`
      SELECT 
        c.year,
        COUNT(*) as nominees
      FROM nominations n
      JOIN award_categories ac ON ac.id = n.category_id
      JOIN ceremonies c ON c.id = ac.ceremony_id
      WHERE ac.name = 'Best Animated Feature'
      GROUP BY c.year
      ORDER BY c.year DESC
    `);
    if (animatedResult.rows.length === 0) {
      console.log('  ⚠️  No Best Animated Feature nominations found\n');
    } else {
      animatedResult.rows.forEach(r => {
        const emoji = r.nominees === 3 ? '✅' : r.nominees === 5 ? '✅' : '⚠️';
        console.log(`  ${emoji} ${r.year}: ${r.nominees} nominees`);
      });
    }

    // Sample other categories
    console.log('\n🎭 ALL CATEGORIES (2024):\n');
    const sampleResult = await client.query(`
      SELECT 
        ac.name,
        COUNT(*) as nominees,
        COUNT(*) FILTER (WHERE n.is_win = true) as winners
      FROM nominations n
      JOIN award_categories ac ON ac.id = n.category_id
      JOIN ceremonies c ON c.id = ac.ceremony_id
      WHERE c.year = 2024
      GROUP BY ac.name
      ORDER BY ac.name
    `);
    sampleResult.rows.forEach(r => {
      console.log(`  ${r.name}: ${r.nominees} nominees, ${r.winners} winner(s)`);
    });

    // Check overall statistics
    console.log('\n📈 OVERALL STATISTICS:\n');
    const statsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT c.year) as years,
        COUNT(DISTINCT ac.name) as unique_categories,
        AVG(nom_count.nominees) as avg_nominees_per_category
      FROM (
        SELECT 
          ac.id,
          COUNT(*) as nominees
        FROM nominations n
        JOIN award_categories ac ON ac.id = n.category_id
        GROUP BY ac.id
      ) nom_count
      JOIN award_categories ac ON ac.id = nom_count.id
      JOIN ceremonies c ON c.id = ac.ceremony_id
      WHERE c.domain = 'film'
    `);
    const stats = statsResult.rows[0];
    console.log(`  Years covered: ${stats.years}`);
    console.log(`  Unique category names: ${stats.unique_categories}`);
    console.log(`  Average nominees per category: ${parseFloat(stats.avg_nominees_per_category).toFixed(2)}`);

  } finally {
    client.release();
    await pool.end();
  }
}

checkNominations().catch(console.error);

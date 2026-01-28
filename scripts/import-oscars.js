#!/usr/bin/env node

/**
 * Import Oscar nominations data into Neon database
 * Usage: node scripts/import-oscars.js [path/to/oscars.json]
 * If no path provided, uses data/oscars_2020_2024.json
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function importOscars(dataPath) {
  const client = await pool.connect();
  
  try {
    console.log('🎬 Starting Oscar nominations import...\n');
    
    const nominations = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`📊 Found ${nominations.length} nominations to import\n`);
    
    await client.query('BEGIN');
    
    let stats = { ceremonies: 0, categories: 0, people: 0, nominations: 0 };
    
    for (let i = 0; i < nominations.length; i++) {
      const nom = nominations[i];
      
      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`   Processing ${i + 1}/${nominations.length}...\r`);
      }
      
      // Insert ceremony
      const ceremonyResult = await client.query(`
        INSERT INTO ceremonies (domain, organization, name, year)
        VALUES ('film', $1, $2, $3)
        ON CONFLICT (domain, organization, year) 
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [nom.org_name, nom.ceremony_name, nom.ceremony_year]);
      const ceremonyId = ceremonyResult.rows[0].id;
      
      // Insert category
      const categoryResult = await client.query(`
        INSERT INTO award_categories (ceremony_id, name)
        VALUES ($1, $2)
        ON CONFLICT (ceremony_id, name) 
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `, [ceremonyId, nom.category_name]);
      const categoryId = categoryResult.rows[0].id;
      
      // Insert nomination (handle null imdb_id for honorary awards)
      const imdbId = nom.imdb_id || `honorary-${ceremonyId}-${categoryId}-${Date.now()}`;
      const nominationResult = await client.query(`
        INSERT INTO nominations (category_id, imdb_id, title, is_win)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (category_id, imdb_id) 
        DO UPDATE SET title = EXCLUDED.title, is_win = EXCLUDED.is_win
        RETURNING id
      `, [categoryId, imdbId, nom.film_title, nom.is_win]);
      const nominationId = nominationResult.rows[0].id;
      stats.nominations++;
      
      // Insert people
      if (nom.people && Array.isArray(nom.people)) {
        for (const person of nom.people) {
          if (!person.name) continue;
          
          const personResult = await client.query(`
            INSERT INTO people (name)
            VALUES ($1)
            ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
            RETURNING id
          `, [person.name]);
          const personId = personResult.rows[0].id;
          
          await client.query(`
            INSERT INTO nomination_people (nomination_id, person_id, role)
            VALUES ($1, $2, $3)
            ON CONFLICT (nomination_id, person_id, role) DO NOTHING
          `, [nominationId, personId, person.role || null]);
        }
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ ${nominations.length} nominations imported\n`);
    console.log('🎉 Import completed successfully!\n');
    
    // Show stats
    const dbStats = await client.query(`
      SELECT 
        COUNT(DISTINCT c.id) FILTER (WHERE c.domain = 'film') as ceremonies,
        COUNT(DISTINCT ac.id) as categories,
        COUNT(DISTINCT n.imdb_id) as films,
        COUNT(n.id) as nominations,
        COUNT(n.id) FILTER (WHERE n.is_win = true) as wins
      FROM ceremonies c
      LEFT JOIN award_categories ac ON ac.ceremony_id = c.id
      LEFT JOIN nominations n ON n.category_id = ac.id
      WHERE c.domain = 'film'
    `);
    
    const row = dbStats.rows[0];
    console.log('📈 Database Statistics (Film Awards):');
    console.log(`   Ceremonies: ${row.ceremonies}`);
    console.log(`   Categories: ${row.categories}`);
    console.log(`   Films: ${row.films}`);
    console.log(`   Nominations: ${row.nominations}`);
    console.log(`   Wins: ${row.wins}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error importing data:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const file = process.argv[2] || path.join(__dirname, '../data/oscars_2020_2024.json');
  
  if (!fs.existsSync(file)) {
    console.error(`❌ File not found: ${file}`);
    process.exit(1);
  }
  
  await importOscars(file);
}

if (require.main === module) {
  main().catch((e) => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
  });
}

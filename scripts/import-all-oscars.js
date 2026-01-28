#!/usr/bin/env node

/**
 * Import all comprehensive Oscar nominations into Neon database
 * This script:
 * 1. Clears existing Oscar data
 * 2. Imports all 13 comprehensive JSON files in chronological order
 * 3. Shows final statistics
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Files to import in chronological order
const files = [
  'data/oscars_comprehensive_1920s.json',
  'data/oscars_comprehensive_1930s.json',
  'data/oscars_comprehensive_1940s.json',
  'data/oscars_comprehensive_1950s.json',
  'data/oscars_comprehensive_1960s.json',
  'data/oscars_comprehensive_1970s.json',
  'data/oscars_comprehensive_1980s.json',
  'data/oscars_comprehensive_1990s.json',
  'data/oscars_comprehensive_2000_2004.json',
  'data/oscars_comprehensive_2005_2009.json',
  'data/oscars_comprehensive_2010_2014.json',
  'data/oscars_comprehensive_2015_2019.json',
  'data/oscars_comprehensive_2020_2024.json'
];

async function clearOscarData(client) {
  console.log('🗑️  Clearing existing Oscar data...\n');
  
  // Delete in proper order due to foreign key constraints
  await client.query(`
    DELETE FROM nomination_people 
    WHERE nomination_id IN (
      SELECT n.id FROM nominations n
      JOIN award_categories ac ON ac.id = n.category_id
      JOIN ceremonies c ON c.id = ac.ceremony_id
      WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
    )
  `);
  
  await client.query(`
    DELETE FROM nominations 
    WHERE category_id IN (
      SELECT ac.id FROM award_categories ac
      JOIN ceremonies c ON c.id = ac.ceremony_id
      WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
    )
  `);
  
  await client.query(`
    DELETE FROM award_categories 
    WHERE ceremony_id IN (
      SELECT id FROM ceremonies 
      WHERE domain = 'film' AND organization LIKE '%Academy%'
    )
  `);
  
  await client.query(`
    DELETE FROM ceremonies 
    WHERE domain = 'film' AND organization LIKE '%Academy%'
  `);
  
  console.log('✅ Existing Oscar data cleared\n');
}

async function importFile(client, filePath) {
  const nominations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const filename = path.basename(filePath);
  
  console.log(`📂 Importing ${filename} (${nominations.length} nominations)...`);
  
  let imported = 0;
  
  for (const nom of nominations) {
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
    const imdbId = nom.imdb_id || `honorary-${ceremonyId}-${categoryId}-${imported}`;
    const nominationResult = await client.query(`
      INSERT INTO nominations (category_id, imdb_id, title, is_win)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (category_id, imdb_id) 
      DO UPDATE SET title = EXCLUDED.title, is_win = EXCLUDED.is_win
      RETURNING id
    `, [categoryId, imdbId, nom.film_title, nom.is_win]);
    const nominationId = nominationResult.rows[0].id;
    imported++;
    
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
  
  console.log(`   ✅ Imported ${imported} nominations\n`);
  return imported;
}

async function importAll() {
  const client = await pool.connect();
  
  try {
    console.log('🎬 Starting comprehensive Oscar import...\n');
    
    await client.query('BEGIN');
    
    // Clear existing Oscar data
    await clearOscarData(client);
    
    // Import all files
    let totalImported = 0;
    for (const file of files) {
      const fullPath = path.join(__dirname, '..', file);
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️  Skipping ${file} (not found)`);
        continue;
      }
      totalImported += await importFile(client, fullPath);
    }
    
    await client.query('COMMIT');
    
    console.log(`\n🎉 Import completed! Total: ${totalImported} nominations\n`);
    
    // Show final statistics
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
    console.log('📈 Final Database Statistics (Film Awards):');
    console.log(`   Ceremonies: ${row.ceremonies}`);
    console.log(`   Categories: ${row.categories}`);
    console.log(`   Films: ${row.films}`);
    console.log(`   Nominations: ${row.nominations}`);
    console.log(`   Wins: ${row.wins}\n`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error during import:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  importAll().catch((e) => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
  });
}

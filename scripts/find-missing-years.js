const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function findMissing() {
  const result = await pool.query(`
    SELECT DISTINCT ceremony_year 
    FROM ceremonies 
    WHERE domain = 'film'
    ORDER BY ceremony_year
  `);
  
  const years = result.rows.map(r => r.ceremony_year);
  console.log('Years we have:', years.length, 'ceremonies');
  
  const missing = [];
  for (let year = 1929; year <= 2024; year++) {
    if (!years.includes(year)) {
      missing.push(year);
    }
  }
  
  console.log('\nMissing years:', missing);
  console.log('Count:', missing.length);
  await pool.end();
}

findMissing();

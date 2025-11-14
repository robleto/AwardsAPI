#!/usr/bin/env node
'use strict';

/**
 * End-to-end test for film-awards endpoint
 * Tests against local Netlify Dev server
 */

const http = require('http');

const BASE_URL = 'http://localhost:8888';

function request(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('🧪 Testing film-awards endpoint...\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Valid IMDb ID with data
  try {
    console.log('Test 1: Valid IMDb ID (tt0133093 - The Matrix)');
    const res = await request('/film-awards?imdb_id=tt0133093');
    
    if (res.status === 200 && res.body.imdb_id === 'tt0133093') {
      console.log(`✅ Status 200, found ${res.body.stats.nominations} nominations\n`);
      passed++;
    } else if (res.status === 404) {
      console.log('⚠️  404 - Sample data not imported yet. Run: node scripts/import-oscars.js data/oscars_sample.json\n');
      failed++;
    } else {
      console.log(`❌ Unexpected status: ${res.status}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
    failed++;
  }

  // Test 2: Valid IMDb ID, no data
  try {
    console.log('Test 2: Valid IMDb ID with no awards (tt9999999)');
    const res = await request('/film-awards?imdb_id=tt9999999');
    
    if (res.status === 404 && res.body.error) {
      console.log('✅ Status 404, correct error message\n');
      passed++;
    } else {
      console.log(`❌ Expected 404, got ${res.status}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
    failed++;
  }

  // Test 3: Invalid IMDb ID format
  try {
    console.log('Test 3: Invalid IMDb ID format (abc123)');
    const res = await request('/film-awards?imdb_id=abc123');
    
    if (res.status === 400) {
      console.log('✅ Status 400, validation working\n');
      passed++;
    } else {
      console.log(`❌ Expected 400, got ${res.status}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
    failed++;
  }

  // Test 4: Missing IMDb ID
  try {
    console.log('Test 4: Missing IMDb ID parameter');
    const res = await request('/film-awards');
    
    if (res.status === 400) {
      console.log('✅ Status 400, validation working\n');
      passed++;
    } else {
      console.log(`❌ Expected 400, got ${res.status}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
    failed++;
  }

  // Test 5: Oppenheimer (if sample data loaded)
  try {
    console.log('Test 5: Oppenheimer (tt15398776)');
    const res = await request('/film-awards?imdb_id=tt15398776');
    
    if (res.status === 200) {
      const hasBestPicture = res.body.nominations?.some(n => 
        n.categories?.some(c => c.category === 'Best Picture' && c.win === true)
      );
      if (hasBestPicture) {
        console.log('✅ Status 200, Best Picture win confirmed\n');
        passed++;
      } else {
        console.log('⚠️  200 but missing expected Best Picture win\n');
        failed++;
      }
    } else if (res.status === 404) {
      console.log('⚠️  404 - Sample data not imported yet\n');
      failed++;
    } else {
      console.log(`❌ Unexpected status: ${res.status}\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ Error: ${e.message}\n`);
    failed++;
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check:');
    console.log('   1. Netlify Dev is running: npm run netlify:dev');
    console.log('   2. DATABASE_URL is set');
    console.log('   3. Migration applied: node scripts/validate-film-schema.js');
    console.log('   4. Sample data loaded: node scripts/import-oscars.js data/oscars_sample.json');
    process.exit(1);
  } else {
    console.log('\n✨ All tests passed!');
    process.exit(0);
  }
}

// Check if server is up first
request('/health').then(() => {
  console.log('✅ Netlify Dev server is running\n');
  return runTests();
}).catch((e) => {
  if (e.code === 'ECONNREFUSED') {
    console.error('❌ Cannot connect to Netlify Dev server.');
    console.error('   Start it with: npm run netlify:dev\n');
  } else {
    console.error('❌ Connection error:', e.message);
  }
  process.exit(1);
});

'use strict';

const db = require('../../config/database');

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    },
    body: JSON.stringify(body)
  };
}

/**
 * Oscar Statistics & Metadata Endpoint
 * 
 * Endpoints:
 * - /oscar-stats (no params): Overall statistics
 * - /oscar-stats?type=categories: List all Oscar categories with counts
 * - /oscar-stats?type=years: List all ceremony years with counts
 * - /oscar-stats?type=top_films: Most nominated films of all time
 * - /oscar-stats?type=top_people: Most nominated people
 * - /oscar-stats?year=2024: Statistics for specific year
 * - /oscar-stats?category=Best Picture: Statistics for specific category
 */
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const qs = event.queryStringParameters || {};
  
  // Accept either header x-api-key or query ?apikey=
  const headerKey = event.headers && (event.headers['x-api-key'] || event.headers['X-API-KEY']);
  const apiKey = headerKey || qs.apikey || qs.api_key || null;

  if (!apiKey && process.env.NETLIFY_DEV !== 'true') {
    return json(401, { error: 'Missing API key' });
  }

  // Validate key if present and not demo
  if (apiKey && apiKey !== 'demo') {
    try {
      const validation = await db.validateApiKey(apiKey);
      if (!validation || !validation.valid) {
        return json(429, { error: validation?.error || 'API key validation failed' });
      }
      if (Array.isArray(validation.allowed_domains) && !validation.allowed_domains.includes('film')) {
        return json(403, { 
          error: 'API key not authorized for film domain',
          allowed_domains: validation.allowed_domains
        });
      }
    } catch (e) {
      console.error('API key validation error:', e);
      return json(500, { error: 'API key validation failed' });
    }
  }

  const t0 = Date.now();
  
  try {
    const sql = db.init();
    const type = qs.type || null;
    const year = qs.year ? parseInt(qs.year) : null;
    const category = qs.category || null;
    
    let payload = {};
    
    if (type === 'overview' || (!type && !year && !category)) {
      // Overall Oscar statistics
      const stats = await sql`
        SELECT 
          COUNT(DISTINCT c.id) as total_ceremonies,
          MIN(c.year) as first_year,
          MAX(c.year) as latest_year,
          COUNT(DISTINCT ac.name) as total_categories,
          COUNT(DISTINCT n.imdb_id) as total_films,
          COUNT(n.id) as total_nominations,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
          COUNT(DISTINCT p.id) as total_people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        LEFT JOIN nomination_people np ON np.nomination_id = n.id
        LEFT JOIN people p ON p.id = np.person_id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
      `;
      
      payload = {
        overview: stats[0],
        data_quality: {
          coverage: '1929-2025 (96 ceremonies)',
          categories_tracked: [
            'Best Picture',
            'Best Director',
            'Best Actor',
            'Best Actress',
            'Best Supporting Actor',
            'Best Supporting Actress',
            'Best Original Screenplay',
            'Best Adapted Screenplay',
            'Best Animated Feature',
            'Lifetime Achievement'
          ],
          note: 'Includes all nominees, not just winners'
        }
      };
      
    } else if (type === 'categories') {
      // List all categories with stats
      const categories = await sql`
        SELECT 
          ac.name as category_name,
          COUNT(n.id) as total_nominations,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
          MIN(c.year) as first_year,
          MAX(c.year) as latest_year,
          COUNT(DISTINCT c.id) as ceremonies_count
        FROM award_categories ac
        JOIN ceremonies c ON c.id = ac.ceremony_id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
        GROUP BY ac.name
        ORDER BY COUNT(n.id) DESC
      `;
      
      payload = { categories };
      
    } else if (type === 'years') {
      // List all years with stats
      const years = await sql`
        SELECT 
          c.year,
          c.name as ceremony_name,
          COUNT(DISTINCT ac.id) as categories_count,
          COUNT(n.id) as nominations_count,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as wins_count,
          COUNT(DISTINCT n.imdb_id) as films_count
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
        GROUP BY c.id, c.year, c.name
        ORDER BY c.year DESC
      `;
      
      payload = { years };
      
    } else if (type === 'top_films') {
      // Most nominated films
      const limit = Math.min(parseInt(qs.limit) || 25, 100);
      
      const films = await sql`
        SELECT 
          n.imdb_id,
          n.title as film_title,
          COUNT(n.id) as total_nominations,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
          json_agg(DISTINCT c.year ORDER BY c.year) as years,
          json_agg(DISTINCT ac.name) as categories
        FROM nominations n
        JOIN award_categories ac ON ac.id = n.category_id
        JOIN ceremonies c ON c.id = ac.ceremony_id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND n.imdb_id NOT LIKE 'honorary-%'
        GROUP BY n.imdb_id, n.title
        HAVING COUNT(n.id) >= 3
        ORDER BY total_nominations DESC, total_wins DESC
        LIMIT ${limit}
      `;
      
      payload = { films, limit };
      
    } else if (type === 'top_people') {
      // Most nominated people
      const limit = Math.min(parseInt(qs.limit) || 25, 100);
      const role = qs.role || null;
      
      let query = sql`
        SELECT 
          p.name,
          np.role,
          COUNT(n.id) as total_nominations,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
          json_agg(DISTINCT c.year ORDER BY c.year) as years
        FROM people p
        JOIN nomination_people np ON np.person_id = p.id
        JOIN nominations n ON n.id = np.nomination_id
        JOIN award_categories ac ON ac.id = n.category_id
        JOIN ceremonies c ON c.id = ac.ceremony_id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
      `;
      
      if (role) {
        query = sql`
          SELECT 
            p.name,
            np.role,
            COUNT(n.id) as total_nominations,
            COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
            json_agg(DISTINCT c.year ORDER BY c.year) as years
          FROM people p
          JOIN nomination_people np ON np.person_id = p.id
          JOIN nominations n ON n.id = np.nomination_id
          JOIN award_categories ac ON ac.id = n.category_id
          JOIN ceremonies c ON c.id = ac.ceremony_id
          WHERE c.domain = 'film' 
            AND c.organization LIKE '%Academy%'
            AND np.role ILIKE ${`%${role}%`}
          GROUP BY p.id, p.name, np.role
          ORDER BY total_nominations DESC, total_wins DESC
          LIMIT ${limit}
        `;
      } else {
        query = sql`
          SELECT 
            p.name,
            np.role,
            COUNT(n.id) as total_nominations,
            COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
            json_agg(DISTINCT c.year ORDER BY c.year) as years
          FROM people p
          JOIN nomination_people np ON np.person_id = p.id
          JOIN nominations n ON n.id = np.nomination_id
          JOIN award_categories ac ON ac.id = n.category_id
          JOIN ceremonies c ON c.id = ac.ceremony_id
          WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          GROUP BY p.id, p.name, np.role
          ORDER BY total_nominations DESC, total_wins DESC
          LIMIT ${limit}
        `;
      }
      
      const people = await query;
      payload = { people, limit, role: role || 'all' };
      
    } else if (year) {
      // Stats for specific year
      const yearStats = await sql`
        SELECT 
          c.year,
          c.name as ceremony_name,
          COUNT(DISTINCT ac.id) as categories_count,
          COUNT(n.id) as nominations_count,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as wins_count,
          COUNT(DISTINCT n.imdb_id) as films_count,
          json_agg(DISTINCT ac.name ORDER BY ac.name) as categories
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' 
          AND c.organization LIKE '%Academy%'
          AND c.year = ${year}
        GROUP BY c.id, c.year, c.name
      `;
      
      payload = yearStats[0] || { error: 'Year not found' };
      
    } else if (category) {
      // Stats for specific category
      const categoryStats = await sql`
        SELECT 
          ac.name as category_name,
          COUNT(n.id) as total_nominations,
          COUNT(n.id) FILTER (WHERE n.is_win = true) as total_wins,
          MIN(c.year) as first_year,
          MAX(c.year) as latest_year,
          COUNT(DISTINCT c.id) as total_ceremonies,
          ROUND(AVG(nom_per_year.count), 2) as avg_nominees_per_year
        FROM award_categories ac
        JOIN ceremonies c ON c.id = ac.ceremony_id
        JOIN nominations n ON n.category_id = ac.id
        JOIN (
          SELECT ac2.id, COUNT(n2.id) as count
          FROM award_categories ac2
          JOIN nominations n2 ON n2.category_id = ac2.id
          GROUP BY ac2.id
        ) nom_per_year ON nom_per_year.id = ac.id
        WHERE c.domain = 'film' 
          AND c.organization LIKE '%Academy%'
          AND ac.name ILIKE ${`%${category}%`}
        GROUP BY ac.name
      `;
      
      payload = categoryStats[0] || { error: 'Category not found' };
      
    } else {
      return json(400, { error: 'Invalid type parameter' });
    }
    
    // Log usage
    try {
      if (apiKey && apiKey !== 'demo') {
        const dt = Date.now() - t0;
        await db.logApiUsage(apiKey, event.path, qs, dt, 200, 'unknown', 'netlify-function');
      }
    } catch (e) {
      console.warn('usage log failed', e?.message);
    }
    
    return json(200, payload);
    
  } catch (err) {
    console.error('oscar-stats error', err);
    try {
      if (apiKey && apiKey !== 'demo') {
        await db.logApiUsage(apiKey, event.path, qs, null, 500, 'unknown', 'netlify-function');
      }
    } catch (_) {}
    return json(500, { error: 'Internal server error', details: err.message });
  }
};

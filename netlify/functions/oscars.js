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
 * Oscars Browse/Search Endpoint
 * 
 * Query parameters:
 * - year: Filter by ceremony year (e.g., 2024)
 * - category: Filter by category name (e.g., "Best Picture", "Best Actor")
 * - winner: Filter to winners only (true/false)
 * - imdb_id: Filter by specific film IMDb ID
 * - limit: Max results to return (default 50, max 500)
 * - offset: Pagination offset (default 0)
 * - sort: Sort order - "year_desc" (default), "year_asc", "category", "film"
 * 
 * Examples:
 * - /oscars?category=Best Picture&winner=true
 * - /oscars?year=2024
 * - /oscars?category=actor&year=2024
 * - /oscars?imdb_id=tt15398776
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
    
    // Parse query parameters
    const year = qs.year ? parseInt(qs.year) : null;
    const category = qs.category || null;
    const winnerOnly = qs.winner === 'true' || qs.winner === '1';
    const imdbId = qs.imdb_id || qs.imdb || null;
    const limit = Math.min(parseInt(qs.limit) || 50, 500);
    const offset = parseInt(qs.offset) || 0;
    const sort = qs.sort || 'year_desc';
    
    // Determine sort order
    let orderBy = 'c.year DESC, ac.name, n.is_win DESC';
    if (sort === 'year_asc') orderBy = 'c.year ASC, ac.name, n.is_win DESC';
    else if (sort === 'category') orderBy = 'ac.name, c.year DESC, n.is_win DESC';
    else if (sort === 'film') orderBy = 'n.title, c.year DESC';
    
    // Build query with conditional filters
    let results, total;
    
    if (year && category && winnerOnly && imdbId) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND c.year = ${year} AND ac.name ILIKE ${`%${category}%`}
          AND n.is_win = true AND n.imdb_id = ${imdbId}
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND c.year = ${year} AND ac.name ILIKE ${`%${category}%`}
          AND n.is_win = true AND n.imdb_id = ${imdbId}
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else if (year && category && winnerOnly) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND c.year = ${year} AND ac.name ILIKE ${`%${category}%`} AND n.is_win = true
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND c.year = ${year} AND ac.name ILIKE ${`%${category}%`} AND n.is_win = true
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else if (year && winnerOnly) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND c.year = ${year} AND n.is_win = true
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND c.year = ${year} AND n.is_win = true
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else if (year) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%' AND c.year = ${year}
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%' AND c.year = ${year}
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else if (category && winnerOnly) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND ac.name ILIKE ${`%${category}%`} AND n.is_win = true
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
          AND ac.name ILIKE ${`%${category}%`} AND n.is_win = true
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else if (category) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%' AND ac.name ILIKE ${`%${category}%`}
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%' AND ac.name ILIKE ${`%${category}%`}
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else if (winnerOnly) {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%' AND n.is_win = true
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%' AND n.is_win = true
      `;
      total = parseInt(countResult[0]?.total || 0);
    } else {
      results = await sql`
        SELECT c.year as ceremony_year, c.name as ceremony_name, ac.name as category_name,
               n.imdb_id, n.title as film_title, n.is_win,
               COALESCE((SELECT json_agg(json_build_object('name', p.name, 'role', np.role))
                         FROM nomination_people np JOIN people p ON p.id = np.person_id
                         WHERE np.nomination_id = n.id), '[]'::json) as people
        FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
        ORDER BY ${sql(orderBy)}
        LIMIT ${limit} OFFSET ${offset}
      `;
      const countResult = await sql`
        SELECT COUNT(*) as total FROM ceremonies c
        JOIN award_categories ac ON ac.ceremony_id = c.id
        JOIN nominations n ON n.category_id = ac.id
        WHERE c.domain = 'film' AND c.organization LIKE '%Academy%'
      `;
      total = parseInt(countResult[0]?.total || 0);
    }
    
    const payload = {
      total,
      limit,
      offset,
      count: results.length,
      results,
      filters: {
        year: year || undefined,
        category: category || undefined,
        winner_only: winnerOnly || undefined,
        imdb_id: imdbId || undefined
      }
    };
    
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
    console.error('oscars browse error', err);
    try {
      if (apiKey && apiKey !== 'demo') {
        await db.logApiUsage(apiKey, event.path, qs, null, 500, 'unknown', 'netlify-function');
      }
    } catch (_) {}
    return json(500, { error: 'Internal server error', details: err.message });
  }
};

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const qs = event.queryStringParameters || {};
  const imdbId = qs.imdb_id || qs.imdb || qs.i;
  if (!imdbId || !/^tt\d{7,}$/.test(imdbId)) {
    return json(400, { error: 'Invalid or missing imdb_id (e.g., tt0133093)' });
  }

  // Optional organization filter (comma-separated). Accept aliases like 'oscars' or 'golden globes'.
  const orgParam = qs.organization || qs.organizations || qs.org || null;
  const orgFilters = (() => {
    if (!orgParam) return null;
    const aliases = new Map([
      ['oscars', 'Academy Awards'],
      ['academy awards', 'Academy Awards'],
      ['academy', 'Academy Awards'],
      ['golden globes', 'Golden Globes'],
      ['golden globe', 'Golden Globes'],
      ['globes', 'Golden Globes'],
      // Future orgs
      ['bafta', 'British Academy Film Awards'],
      ['british academy', 'British Academy Film Awards'],
      ['british academy film awards', 'British Academy Film Awards'],
      ['sag', 'Screen Actors Guild Awards'],
      ['sag awards', 'Screen Actors Guild Awards'],
      ['screen actors guild', 'Screen Actors Guild Awards']
    ]);
    return String(orgParam)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        const k = s.toLowerCase();
        return aliases.get(k) || s;
      });
  })();

  // Accept either header x-api-key or query ?apikey= (to match existing endpoints)
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
        return json(429, { 
          error: validation?.error || 'API key validation failed'
        });
      }
      // Optional domain enforcement if metadata available
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

    const dataRows = await sql`SELECT get_film_awards_by_imdb(${imdbId}) AS data`;
    const badgesRows = await sql`SELECT get_film_award_badges_by_imdb(${imdbId}) AS badges`;

    let data = dataRows?.[0]?.data || null;
    const badges = badgesRows?.[0]?.badges || [];

    if (data && Array.isArray(data.nominations) && orgFilters && orgFilters.length) {
      data = {
        ...data,
        nominations: data.nominations.filter(n => orgFilters.includes(n.organization))
      };
    }

    const hasAny = !!(data && Array.isArray(data.nominations) && data.nominations.length);

    const sources = hasAny
      ? Array.from(new Set((data.nominations || []).map(n => n.organization)))
      : [];

    const payload = hasAny
      ? {
          imdb_id: imdbId,
          nominations: data.nominations,
          badges,
          stats: data.stats || { nominations: data.nominations.length, wins: 0 },
          sources
        }
      : { error: 'No awards found for imdb_id', imdb_id: imdbId };

    const statusCode = hasAny ? 200 : 404;

    // Best-effort usage log
    try {
      if (apiKey && apiKey !== 'demo') {
        const dt = Date.now() - t0;
        await db.logApiUsage(apiKey, event.path, { imdb_id: imdbId }, dt, statusCode, 'unknown', 'netlify-function');
      }
    } catch (e) {
      console.warn('usage log failed', e?.message);
    }

    return json(statusCode, payload);
  } catch (err) {
    console.error('film-awards error', err);
    try {
      if (apiKey && apiKey !== 'demo') {
        await db.logApiUsage(apiKey, event.path, { imdb_id: imdbId }, null, 500, 'unknown', 'netlify-function');
      }
    } catch (_) {}
    return json(500, { error: 'Internal server error' });
  }
};

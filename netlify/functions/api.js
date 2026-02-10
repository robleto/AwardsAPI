const db = require('../../config/database');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  try {
    const { queryStringParameters: query } = event;
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          Response: "False",
          Error: "No parameters provided. Please provide 'i' (award ID), 't' (title), 's' (search), or 'game_id'."
        })
      };
    }

    const {
      i: awardId,
      t: title,
      s: search,
      game_id,
      year,
      category,
      award_set,
      type,
      r: format = 'json',
      apikey,
      page,
      limit,
      per_page,
      page_size,
    } = query;

    const parsedLimit = Math.min(
      Math.max(parseInt(limit || per_page || page_size || '50', 10) || 50, 1),
      200
    );
    const parsedPage = Math.max(parseInt(page || '1', 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    // Check API key in production
    if (process.env.NETLIFY_DEV !== 'true' && !apikey) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({
          Response: "False",
          Error: "No API key provided. Get your free API key at https://gameawards.netlify.app/apikey"
        })
      };
    }

    // Validate API key if provided
    if (apikey && apikey !== 'demo') {
      try {
        const validation = await db.validateApiKey(apikey);
        if (!validation || !validation.valid) {
          return {
            statusCode: 429,
            headers,
            body: JSON.stringify({
              Response: "False",
              Error: validation?.error || "API key validation failed",
              RemainingRequests: validation?.requests_remaining_today || 0,
              MonthlyLimit: validation?.monthly_limit || 1000
            })
          };
        }
        // Optional domain enforcement if metadata available
        if (Array.isArray(validation.allowed_domains) && !validation.allowed_domains.includes('games')) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({
              Response: "False",
              Error: "API key not authorized for games domain",
              AllowedDomains: validation.allowed_domains
            })
          };
        }
        // Add usage info to response headers
        headers['X-RateLimit-Remaining-Daily'] = validation.requests_remaining_today || 0;
        headers['X-RateLimit-Remaining-Monthly'] = validation.requests_remaining_month || 0;
        headers['X-RateLimit-Tier'] = validation.tier || 'free';
        if (validation.allowed_domains) {
          headers['X-Allowed-Domains'] = JSON.stringify(validation.allowed_domains);
        }
      } catch (e) {
        console.error('API key validation error:', e);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            Response: "False",
            Error: "API key validation failed"
          })
        };
      }
    }

    let result;
    const sql = db.init();
    const filters = { year, category, award_set, type, limit: parsedLimit, offset };

    if (search) {
      result = await searchAwards(sql, search, filters);
    } else if (awardId) {
      result = await getAwardById(sql, awardId);
    } else if (title) {
      result = await getAwardByTitle(sql, title, { year, category, award_set });
    } else if (game_id) {
      result = await getAwardsByGameId(sql, game_id);
    } else if (year || category || award_set || type) {
      // Allow filtered queries without a search term (e.g., year-only sync)
      result = await searchAwards(sql, '', filters);
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          Response: "False",
          Error: "Incorrect parameters. Please provide 'i' (award ID), 't' (title), 's' (search), or 'game_id'."
        })
      };
    }

    // Log API usage to Neon
    if (apikey && apikey !== 'demo') {
      try {
        await db.logApiUsage(apikey, event.path, query);
      } catch (e) {
        console.error('Failed to log API usage to Neon:', e);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        Response: "False",
        Error: "Internal server error"
      })
    };
  }
};

function formatAwardRow(row) {
  const boardgames = Array.isArray(row.boardgames) ? row.boardgames : [];
  return {
    id: row.id,
    slug: row.slug,
    url: row.url,
    year: row.year,
    title: row.title,
    primaryName: row.primary_name || boardgames[0]?.name || null,
    alternateNames: row.alternate_names || [],
    boardgames,
    awardSet: row.award_set_raw || row.award_set || "",
    position: row.position || "",
    isWinner: row.is_winner,
    isNominee: row.is_nominee
  };
}

function buildFilters(filters = {}, params = []) {
  const clauses = [];

  if (filters.year) {
    params.push(parseInt(filters.year, 10));
    clauses.push(`a.year = $${params.length}`);
  }
  if (filters.category) {
    params.push(`%${filters.category}%`);
    clauses.push(`a.position ILIKE $${params.length}`);
  }
  if (filters.award_set) {
    params.push(`%${filters.award_set}%`);
    clauses.push(`(a.award_set ILIKE $${params.length} OR a.award_set_raw ILIKE $${params.length})`);
  }
  if (filters.type) {
    params.push(`%${filters.type}%`);
    clauses.push(`a.title ILIKE $${params.length}`);
  }

  return clauses;
}

async function getAwardById(sql, id) {
  const rows = await sql`
    SELECT
      a.*,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object('name', g.name, 'gameId', g.id)
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'::jsonb
      ) AS boardgames
    FROM boardgames.awards a
    LEFT JOIN boardgames.award_games ag ON ag.award_id = a.id
    LEFT JOIN boardgames.games g ON g.id = ag.game_id
    WHERE a.id = ${id}
    GROUP BY a.id
    LIMIT 1
  `;

  const row = rows?.[0];
  if (!row) {
    return {
      Response: "False",
      Error: "Award not found!"
    };
  }
  return {
    Response: "True",
    ...formatAwardRow(row)
  };
}

async function getAwardByTitle(sql, title, filters = {}) {
  const params = [`%${title}%`];
  const clauses = buildFilters(filters, params);
  clauses.unshift(`a.title ILIKE $1`);

  const query = `
    SELECT
      a.*,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object('name', g.name, 'gameId', g.id)
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'::jsonb
      ) AS boardgames
    FROM boardgames.awards a
    LEFT JOIN boardgames.award_games ag ON ag.award_id = a.id
    LEFT JOIN boardgames.games g ON g.id = ag.game_id
    WHERE ${clauses.join(" AND ")}
    GROUP BY a.id
    ORDER BY a.year DESC NULLS LAST
  `;

  const rows = await sql(query, params);

  if (!rows || rows.length === 0) {
    return {
      Response: "False",
      Error: "Award not found!"
    };
  }

  if (rows.length === 1) {
    return {
      Response: "True",
      ...formatAwardRow(rows[0])
    };
  }

  return {
    Response: "True",
    totalResults: rows.length,
    awards: rows.map(formatAwardRow)
  };
}

async function getAwardsByGameId(sql, gameId) {
  const rows = await sql`
    SELECT
      a.*,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object('name', g.name, 'gameId', g.id)
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'::jsonb
      ) AS boardgames
    FROM boardgames.award_games ag
    JOIN boardgames.awards a ON a.id = ag.award_id
    JOIN boardgames.games g ON g.id = ag.game_id
    WHERE ag.game_id = ${gameId}
    GROUP BY a.id
    ORDER BY a.year DESC NULLS LAST
  `;

  if (!rows || rows.length === 0) {
    return {
      Response: "False",
      Error: "No awards found for this game!"
    };
  }

  const gameName = rows[0].boardgames?.find(bg => bg.gameId == gameId)?.name || null;

  return {
    Response: "True",
    gameId: gameId,
    gameName: gameName,
    totalResults: rows.length,
    awards: rows.map(formatAwardRow)
  };
}

async function searchAwards(sql, searchTerm, filters = {}) {
  const params = [];
  const clauses = buildFilters(filters, params);

  if (searchTerm && String(searchTerm).trim().length > 0) {
    params.unshift(`%${searchTerm}%`);
    clauses.unshift(
      `(a.title ILIKE $1 OR a.award_set ILIKE $1 OR a.award_set_raw ILIKE $1 OR a.position ILIKE $1 OR g.name ILIKE $1)`
    );
  }

  const limitValue = Math.min(Math.max(parseInt(filters.limit, 10) || 50, 1), 200);
  const offsetValue = Math.max(parseInt(filters.offset, 10) || 0, 0);
  params.push(limitValue);
  const limitIndex = params.length;
  params.push(offsetValue);
  const offsetIndex = params.length;

  const whereClause = clauses.length ? clauses.join(" AND ") : "TRUE";

  const query = `
    SELECT
      a.*,
      COALESCE(
        jsonb_agg(
          DISTINCT jsonb_build_object('name', g.name, 'gameId', g.id)
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'::jsonb
      ) AS boardgames
    FROM boardgames.awards a
    LEFT JOIN boardgames.award_games ag ON ag.award_id = a.id
    LEFT JOIN boardgames.games g ON g.id = ag.game_id
    WHERE ${whereClause}
    GROUP BY a.id
    ORDER BY a.year DESC NULLS LAST
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
  `;

  const rows = await sql(query, params);

  if (!rows || rows.length === 0) {
    return {
      Response: "False",
      Error: "No awards found!"
    };
  }

  return {
    Response: "True",
    totalResults: rows.length,
    search: searchTerm,
    awards: rows.map(formatAwardRow)
  };
}

// Log API usage wrapper (uses Neon db helper)
async function logApiUsage(apiKey, endpoint, params) {
  try {
    await db.logApiUsage(apiKey, endpoint, params, null, 200, 'unknown', 'netlify-function');
  } catch (error) {
    console.error('Failed to log API usage via db helper:', error);
  }
}

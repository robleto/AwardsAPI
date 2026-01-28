const db = require('../../config/database');

// Load awards data (for now, still using JSON file)
// In production, this would come from the database
const awardsData = require('../../lib/awards-data');

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
          Error: "No parameters provided. Please provide 'i' (award ID), 't' (title), 's' (search), or 'bgg_id'."
        })
      };
    }

    const { i: awardId, t: title, s: search, bgg_id, year, category, award_set, type, r: format = 'json', apikey } = query;

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

    if (search) {
      result = searchAwards(search, { year, category, award_set, type });
    } else if (awardId) {
      result = getAwardById(awardId);
    } else if (title) {
      result = getAwardByTitle(title, { year, category, award_set });
    } else if (bgg_id) {
      result = getAwardsByBggId(bgg_id);
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          Response: "False",
          Error: "Incorrect parameters. Please provide 'i' (award ID), 't' (title), 's' (search), or 'bgg_id'."
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

// Helper functions (same as original server.js)
function getAwardById(id) {
  const award = awardsData.find(a => a.id === id);
  if (!award) {
    return {
      Response: "False",
      Error: "Award not found!"
    };
  }
  return {
    Response: "True",
    ...award
  };
}

function getAwardByTitle(title, filters = {}) {
  let results = awardsData.filter(award => 
    award.title && award.title.toLowerCase().includes(title.toLowerCase())
  );

  // Apply filters
  if (filters.year) {
    results = results.filter(award => award.year == filters.year);
  }
  if (filters.category) {
    results = results.filter(award => 
      award.position && award.position.toLowerCase().includes(filters.category.toLowerCase())
    );
  }
  if (filters.award_set) {
    results = results.filter(award => 
      award.awardSet && award.awardSet.toLowerCase().includes(filters.award_set.toLowerCase())
    );
  }

  if (results.length === 0) {
    return {
      Response: "False",
      Error: "Award not found!"
    };
  }

  if (results.length === 1) {
    return {
      Response: "True",
      ...results[0]
    };
  }

  return {
    Response: "True",
    totalResults: results.length,
    awards: results
  };
}

function getAwardsByBggId(bggId) {
  const awards = awardsData.filter(award => 
    award.boardgames && award.boardgames.some(game => game.bggId == bggId)
  );

  if (awards.length === 0) {
    return {
      Response: "False",
      Error: "No awards found for this game!"
    };
  }

  const gameName = awards[0].boardgames.find(game => game.bggId == bggId)?.name;

  return {
    Response: "True",
    bggId: bggId,
    gameName: gameName,
    totalResults: awards.length,
    awards: awards
  };
}

function searchAwards(searchTerm, filters = {}) {
  let results = awardsData.filter(award => {
    const titleMatch = award.title && award.title.toLowerCase().includes(searchTerm.toLowerCase());
    const awardSetMatch = award.awardSet && award.awardSet.toLowerCase().includes(searchTerm.toLowerCase());
    const positionMatch = award.position && award.position.toLowerCase().includes(searchTerm.toLowerCase());
    const gameMatch = award.boardgames && award.boardgames.some(game => 
      game.name && game.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return titleMatch || awardSetMatch || positionMatch || gameMatch;
  });

  // Apply filters
  if (filters.year) {
    results = results.filter(award => award.year == filters.year);
  }
  if (filters.category) {
    results = results.filter(award => 
      award.position && award.position.toLowerCase().includes(filters.category.toLowerCase())
    );
  }
  if (filters.award_set) {
    results = results.filter(award => 
      award.awardSet && award.awardSet.toLowerCase().includes(filters.award_set.toLowerCase())
    );
  }
  if (filters.type) {
    results = results.filter(award => 
      award.title && award.title.toLowerCase().includes(filters.type.toLowerCase())
    );
  }

  if (results.length === 0) {
    return {
      Response: "False",
      Error: "No awards found!"
    };
  }

  return {
    Response: "True",
    totalResults: results.length,
    search: searchTerm,
    awards: results.slice(0, 10)
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

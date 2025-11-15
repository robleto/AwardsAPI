const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Load awards data
const awardsData = require('./lib/awards-data');

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Rate limiting - similar to OMDB's approach
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: {
    Response: "False",
    Error: "Request limit exceeded"
  }
});
app.use('/api/', limiter);

// Static files for landing page
app.use(express.static('public'));

// API Routes

// Landing page route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Documentation route
app.get('/docs', (req, res) => {
  res.sendFile(__dirname + '/public/docs.html');
});

// API key request route
app.get('/apikey', (req, res) => {
  res.sendFile(__dirname + '/public/apikey.html');
});

// Main API endpoint - Get award by ID
app.get('/api/', (req, res) => {
  const { i: awardId, t: title, s: search, bgg_id, year, category, award_set, type, r: format = 'json' } = req.query;
  
  // Require API key for production
  const apiKey = req.query.apikey;
  if (process.env.NODE_ENV === 'production' && !apiKey) {
    return res.status(401).json({
      Response: "False",
      Error: "No API key provided. Request API key at https://awardsapi.com/apikey"
    });
  }

  try {
    let result;

    if (search) {
      // Search functionality
      result = searchAwards(search, { year, category, award_set, type });
    } else if (awardId) {
      // Get specific award by ID
      result = getAwardById(awardId);
    } else if (title) {
      // Get award by title
      result = getAwardByTitle(title, { year, category, award_set });
    } else if (bgg_id) {
      // Get all awards for a specific BGG game ID
      result = getAwardsByBggId(bgg_id);
    } else {
      return res.status(400).json({
        Response: "False",
        Error: "Incorrect parameters. Please provide 'i' (award ID), 't' (title), 's' (search), or 'bgg_id'."
      });
    }

    if (format === 'xml') {
      // TODO: Implement XML response format
      return res.status(501).json({
        Response: "False",
        Error: "XML format not yet implemented"
      });
    }

    res.json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      Response: "False",
      Error: "Internal server error"
    });
  }
});

// Get all available award sets
app.get('/api/awards', (req, res) => {
  const awardSets = [...new Set(awardsData.map(award => award.awardSet))].sort();
  res.json({
    Response: "True",
    totalResults: awardSets.length,
    awardSets: awardSets
  });
});

// Get all available categories/positions
app.get('/api/categories', (req, res) => {
  const categories = [...new Set(awardsData.map(award => award.position))].sort();
  res.json({
    Response: "True",
    totalResults: categories.length,
    categories: categories
  });
});

// Get awards by year
app.get('/api/years/:year', (req, res) => {
  const { year } = req.params;
  const yearAwards = awardsData.filter(award => award.year == year);
  
  res.json({
    Response: yearAwards.length > 0 ? "True" : "False",
    totalResults: yearAwards.length,
    year: year,
    awards: yearAwards
  });
});

// Helper functions
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
    award.title.toLowerCase().includes(title.toLowerCase())
  );

  // Apply filters
  if (filters.year) {
    results = results.filter(award => award.year == filters.year);
  }
  if (filters.category) {
    results = results.filter(award => 
      award.position.toLowerCase().includes(filters.category.toLowerCase())
    );
  }
  if (filters.award_set) {
    results = results.filter(award => 
      award.awardSet.toLowerCase().includes(filters.award_set.toLowerCase())
    );
  }

  if (results.length === 0) {
    return {
      Response: "False",
      Error: "Award not found!"
    };
  }

  // Return first match for single result, or all matches
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
    award.boardgames.some(game => game.bggId == bggId)
  );

  if (awards.length === 0) {
    return {
      Response: "False",
      Error: "No awards found for this game!"
    };
  }

  // Get game name from first result
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
    const titleMatch = award.title.toLowerCase().includes(searchTerm.toLowerCase());
    const awardSetMatch = award.awardSet.toLowerCase().includes(searchTerm.toLowerCase());
    const positionMatch = award.position.toLowerCase().includes(searchTerm.toLowerCase());
    const gameMatch = award.boardgames.some(game => 
      game.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    return titleMatch || awardSetMatch || positionMatch || gameMatch;
  });

  // Apply filters
  if (filters.year) {
    results = results.filter(award => award.year == filters.year);
  }
  if (filters.category) {
    results = results.filter(award => 
      award.position.toLowerCase().includes(filters.category.toLowerCase())
    );
  }
  if (filters.award_set) {
    results = results.filter(award => 
      award.awardSet.toLowerCase().includes(filters.award_set.toLowerCase())
    );
  }
  if (filters.type) {
    // Type could be 'winner', 'nominee', etc.
    results = results.filter(award => 
      award.title.toLowerCase().includes(filters.type.toLowerCase())
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
    awards: results.slice(0, 10) // Limit to first 10 results like OMDB
  };
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    Response: "False",
    Error: "Endpoint not found"
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    Response: "False",
    Error: "Internal server error"
  });
});

app.listen(PORT, () => {
  console.log(`🎲 Game Awards API server running on port ${PORT}`);
  console.log(`📊 Loaded ${awardsData.length} awards`);
  console.log(`🌐 API endpoint: http://localhost:${PORT}/api/`);
});

module.exports = app;

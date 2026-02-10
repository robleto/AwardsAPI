// Unified awards data loader.
// Tries to load the full private dataset from internal/ (gitignored) and
// falls back to the public sample dataset tracked in the repo.
// Processing mirrors the earlier dev-scripts/awards-data.js implementation.

let rawData;
try {
  // Private full dataset (not in repo)
  rawData = require('../internal/enhanced-honors-complete.json');
  // eslint-disable-next-line no-console
  console.log('📦 Loaded full private dataset (internal)');
} catch (_) {
  rawData = require('../data/sample-awards.json');
  // eslint-disable-next-line no-console
  console.log('📦 Loaded sample dataset (public)');
}

const gameIdByName = new Map();
const nameByGameId = new Map();

function normalizeGameName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function hashString(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeAwardSetName(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  // Strip leading year or year range like "2021 " or "1930/31 " or "1930-31 ".
  const stripped = raw.replace(/^\d{4}(?:[/-]\d{2,4})?\s+/, '');
  return stripped.trim();
}

function getGameId(name) {
  const normalized = normalizeGameName(name);
  if (!normalized) {
    return null;
  }
  if (gameIdByName.has(normalized)) {
    return gameIdByName.get(normalized);
  }

  const baseId = `game_${hashString(normalized).toString(36)}`;
  let gameId = baseId;
  let suffix = 2;
  while (nameByGameId.has(gameId) && nameByGameId.get(gameId) !== normalized) {
    gameId = `${baseId}_${suffix}`;
    suffix += 1;
  }

  gameIdByName.set(normalized, gameId);
  nameByGameId.set(gameId, normalized);
  return gameId;
}

const awardsData = rawData.map(award => ({
  ...award,
  year: award.year ? parseInt(award.year) : null,
  boardgames: (award.boardgames || []).map(game => {
    const cleaned = { ...game };
    delete cleaned.bggId;
    delete cleaned.bgg_id;
    if (!cleaned.gameId) {
      cleaned.gameId = cleaned.id || getGameId(cleaned.name);
    }
    return cleaned;
  }),
  isWinner: award.title ? award.title.toLowerCase().includes('winner') : false,
  isNominee: award.title
    ? (award.title.toLowerCase().includes('nominee') || award.title.toLowerCase().includes('nom'))
    : false,
  title: award.title ? award.title.trim() : '',
  awardSetRaw: award.awardSet ? award.awardSet.trim() : '',
  awardSet: normalizeAwardSetName(award.awardSet),
  position: award.position ? award.position.trim() : ''
}));

// Minimal export (indices can be re-added when DB-backed search arrives)
module.exports = awardsData;

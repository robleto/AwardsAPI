#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in environment");
  process.exit(1);
}

function normalizeGameName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
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
  const raw = String(value || "").trim();
  if (!raw) return "";
  const stripped = raw.replace(/^\d{4}(?:[/-]\d{2,4})?\s+/, "");
  return stripped.trim();
}

function getDatasetPath() {
  const root = path.resolve(__dirname, "..");
  const internal = path.join(root, "internal", "enhanced-honors-complete.json");
  const full = path.join(root, "data", "enhanced-honors-complete.json");
  const sample = path.join(root, "data", "sample-awards.json");

  if (fs.existsSync(internal)) return internal;
  if (fs.existsSync(full)) return full;
  return sample;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function makePlaceholders(rowCount, colCount, startIndex = 1) {
  const rows = [];
  let idx = startIndex;
  for (let r = 0; r < rowCount; r += 1) {
    const cols = [];
    for (let c = 0; c < colCount; c += 1) {
      cols.push(`$${idx}`);
      idx += 1;
    }
    rows.push(`(${cols.join(", ")})`);
  }
  return rows.join(", ");
}

function pickGameId(game, fallbackName) {
  if (game && game.gameId) return game.gameId;
  if (game && game.id) return game.id;
  const normalized = normalizeGameName(game?.name || fallbackName);
  if (!normalized) return null;
  return `game_${hashString(normalized).toString(36)}`;
}

async function insertGames(client, games) {
  const rows = games.map((g) => [g.id, g.name, g.normalized_name]);
  const chunks = chunkArray(rows, 500);
  for (const chunk of chunks) {
    const text = `
      INSERT INTO boardgames.games (id, name, normalized_name)
      VALUES ${makePlaceholders(chunk.length, 3)}
      ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          normalized_name = EXCLUDED.normalized_name
    `;
    const values = chunk.flat();
    await client.query(text, values);
  }
}

async function insertAwards(client, awards) {
  const rows = awards.map((a) => [
    a.id,
    a.slug,
    a.url,
    a.year,
    a.title,
    a.primary_name,
    a.award_set_raw,
    a.award_set,
    a.position,
    a.is_winner,
    a.is_nominee,
    a.alternate_names,
  ]);
  const chunks = chunkArray(rows, 300);
  for (const chunk of chunks) {
    const text = `
      INSERT INTO boardgames.awards (
        id, slug, url, year, title, primary_name, award_set_raw, award_set,
        position, is_winner, is_nominee, alternate_names
      )
      VALUES ${makePlaceholders(chunk.length, 12)}
      ON CONFLICT (id) DO UPDATE
      SET slug = EXCLUDED.slug,
          url = EXCLUDED.url,
          year = EXCLUDED.year,
          title = EXCLUDED.title,
          primary_name = EXCLUDED.primary_name,
          award_set_raw = EXCLUDED.award_set_raw,
          award_set = EXCLUDED.award_set,
          position = EXCLUDED.position,
          is_winner = EXCLUDED.is_winner,
          is_nominee = EXCLUDED.is_nominee,
          alternate_names = EXCLUDED.alternate_names,
          updated_at = now()
    `;
    const values = chunk.flat();
    await client.query(text, values);
  }
}

async function insertAwardGames(client, pairs) {
  const rows = pairs.map((p) => [p.award_id, p.game_id]);
  const chunks = chunkArray(rows, 1000);
  for (const chunk of chunks) {
    const text = `
      INSERT INTO boardgames.award_games (award_id, game_id)
      VALUES ${makePlaceholders(chunk.length, 2)}
      ON CONFLICT DO NOTHING
    `;
    const values = chunk.flat();
    await client.query(text, values);
  }
}

async function main() {
  const datasetPath = getDatasetPath();
  const raw = JSON.parse(fs.readFileSync(datasetPath, "utf8"));

  const limit = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
  const data = limit ? raw.slice(0, limit) : raw;

  const gameMap = new Map();
  const awardRows = [];
  const awardGameRows = [];

  for (const award of data) {
    const title = String(award.title || "").trim();
    const titleLower = title.toLowerCase();

    const awardId = String(award.id);
    const awardSetRaw = award.awardSet ? String(award.awardSet).trim() : "";
    const awardSet = normalizeAwardSetName(award.awardSet);

    awardRows.push({
      id: awardId,
      slug: award.slug || null,
      url: award.url || null,
      year: award.year ? parseInt(award.year, 10) : null,
      title,
      primary_name: award.primaryName || null,
      award_set_raw: awardSetRaw,
      award_set: awardSet,
      position: award.position ? String(award.position).trim() : null,
      is_winner: typeof award.isWinner === "boolean"
        ? award.isWinner
        : titleLower.includes("winner"),
      is_nominee: typeof award.isNominee === "boolean"
        ? award.isNominee
        : (titleLower.includes("nominee") || titleLower.includes("nom")),
      alternate_names: Array.isArray(award.alternateNames) ? award.alternateNames : [],
    });

    const boardgames = Array.isArray(award.boardgames) ? award.boardgames : [];
    for (const game of boardgames) {
      const gameId = pickGameId(game, award.primaryName);
      if (!gameId) continue;
      const gameName = String(game?.name || award.primaryName || "").trim();
      const normalized = normalizeGameName(gameName);
      if (!gameMap.has(gameId)) {
        gameMap.set(gameId, {
          id: gameId,
          name: gameName || gameId,
          normalized_name: normalized || gameId,
        });
      }
      awardGameRows.push({ award_id: awardId, game_id: gameId });
    }
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    console.log(`Dataset: ${path.basename(datasetPath)}`);
    console.log(`Awards: ${awardRows.length}`);
    console.log(`Games: ${gameMap.size}`);
    console.log(`Links: ${awardGameRows.length}`);

    await client.query("BEGIN");
    await insertGames(client, Array.from(gameMap.values()));
    await insertAwards(client, awardRows);
    await insertAwardGames(client, awardGameRows);
    await client.query("COMMIT");
    console.log("Import complete.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Import failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

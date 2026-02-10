#!/usr/bin/env node
"use strict";

// Applies a set of SQL files to the Neon database specified by DATABASE_URL
// Usage: node -r dotenv/config scripts/apply-neon-sql.js [file1.sql file2.sql ...]
// If no files passed, applies a default ordered set.

const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required in environment");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function resolveFiles(args) {
  if (args.length > 0) {
    return args.map((f) => path.resolve(process.cwd(), f));
  }
  const root = path.resolve(__dirname, "..", "neon");
  return [
    path.join(root, "000_enable_pgcrypto.sql"),
    path.join(root, "schema.sql"),
    path.join(root, "subscription-schema.sql"),
    path.join(root, "20251114_domain_access_control.sql"),
    path.join(root, "20251115_add_domains_to_validate_enhanced.sql"),
    path.join(root, "20251116_fix_ambiguous_key_hash.sql"),
  ];
}

function splitStatements(sqlText) {
  // Remove single-line comments and split on semicolons not within strings or $$ blocks.
  const lines = sqlText
    .split(/\r?\n/)
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");

  const statements = [];
  let current = "";
  let inString = false;
  let quote = null;
  let inDollar = false;

  for (let i = 0; i < lines.length; i++) {
    const ch = lines[i];
    const prev = i > 0 ? lines[i - 1] : null;
    const next2 = lines.slice(i, i + 2);

    // Detect start/end of dollar-quoted literal $$ when not inside a regular string
    if (!inString && next2 === "$$") {
      inDollar = !inDollar;
      current += "$$";
      i++; // skip an extra character since we consumed 2 chars
      continue;
    }

    if (!inDollar && !inString && (ch === '"' || ch === "'")) {
      inString = true;
      quote = ch;
      current += ch;
      continue;
    }
    if (inString) {
      current += ch;
      if (ch === quote && prev !== "\\") {
        inString = false;
        quote = null;
      }
      continue;
    }
    if (!inDollar && ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function applyFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`Skip (missing): ${filePath}`);
    return;
  }
  const content = fs.readFileSync(filePath, "utf8");
  const statements = splitStatements(content);
  console.log(`Applying: ${path.basename(filePath)} (${statements.length} statements)`);
  for (const stmt of statements) {
    try {
      await sql(stmt);
    } catch (err) {
      console.error(`Error applying statement from ${path.basename(filePath)}:`);
      console.error(stmt);
      console.error(err.message);
      throw err;
    }
  }
}

(async () => {
  try {
    const args = process.argv.slice(2);
    const files = resolveFiles(args);
    for (const f of files) {
      await applyFile(f);
    }
    console.log("All SQL applied successfully.");
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
})();

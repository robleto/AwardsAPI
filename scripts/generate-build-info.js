#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const buildInfo = {
  timestamp: new Date().toISOString(),
  version: require('../package.json').version,
  node: process.version
};

try {
  buildInfo.commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  buildInfo.branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
} catch (e) {
  buildInfo.commit = 'unknown';
  buildInfo.branch = 'unknown';
}

const outPath = path.join(__dirname, '..', 'build-info.json');
fs.writeFileSync(outPath, JSON.stringify(buildInfo, null, 2));
console.log(`✔ Generated build-info.json`);

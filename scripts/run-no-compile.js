#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD_ID = path.join(ROOT, '.next', 'BUILD_ID');
const NODE = process.execPath;
const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');
const PORT = process.env.PORT || '9641';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run(NODE, [path.join(ROOT, 'scripts', 'kill-port.js'), PORT]);

if (!fs.existsSync(BUILD_ID)) {
  run('npm', ['run', 'build'], { shell: true });
}

run(NODE, [NEXT_BIN, 'start', '-p', PORT]);

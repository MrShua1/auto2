#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { validateContentReview } = require('./lib/content-review.cjs');
const options = { '--project-root': process.cwd(), '--config': 'episode-package-config.json', '--state': 'auto-state.json' };
try {
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    if (!(key in options) || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`Invalid argument: ${key}`);
    options[key] = process.argv[index + 1];
  }
  const root = path.resolve(options['--project-root']);
  const configPath = path.resolve(root, options['--config']);
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  console.log(JSON.stringify(validateContentReview({ root, configPath, config: read(configPath), state: read(path.resolve(root, options['--state'])) })));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

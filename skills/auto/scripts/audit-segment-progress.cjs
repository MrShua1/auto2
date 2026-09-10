#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const options = { projectRoot: process.cwd(), config: 'episode-package-config.json', state: 'auto-state.json', output: 'segment-progress.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node audit-segment-progress.cjs --project-root <path> [--config <path>] [--state <path>] [--output <path>]');
      process.exit(0);
    }
    if (!['--project-root', '--config', '--state', '--output'].includes(arg)) fail(`Unknown argument: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
    options[arg.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  options.projectRoot = path.resolve(options.projectRoot);
  for (const key of ['config', 'state', 'output']) {
    options[key] = path.isAbsolute(options[key]) ? path.normalize(options[key]) : path.resolve(options.projectRoot, options[key]);
  }
  return options;
}

function readJson(filePath, label, required = true) {
  if (!fs.existsSync(filePath)) {
    if (!required) return null;
    fail(`Missing ${label}: ${filePath}`);
  }
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { fail(`Invalid ${label}: ${error.message}`); }
}

function resolveFrom(root, value) {
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
}

function isFile(filePath) {
  try { return fs.statSync(filePath).isFile(); }
  catch { return false; }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const config = readJson(options.config, 'episode package config');
  const state = readJson(options.state, 'Auto state', false);
  if (!Array.isArray(config.segments) || config.segments.length === 0) fail('Config has no declared generation segments.');

  const ids = config.segments.map((segment) => segment.id);
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) fail('Segment plan contains duplicate IDs.');
  ids.forEach((id, index) => {
    const expected = `SEG${String(index + 1).padStart(3, '0')}`;
    if (id !== expected) fail(`Segments must be contiguous and ordered. Expected ${expected}, found ${id || 'EMPTY'}.`);
  });
  if (config.declaredSegmentCount != null && Number(config.declaredSegmentCount) !== ids.length) {
    fail(`declaredSegmentCount ${config.declaredSegmentCount} does not match ${ids.length} unique configured segments.`);
  }

  const totalDurationSeconds = config.segments.reduce((sum, segment) => {
    const duration = Number(segment.durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) fail(`${segment.id} has an invalid durationSeconds.`);
    return sum + duration;
  }, 0);
  const targetDuration = Number(config.targetDurationSeconds || state?.project?.targetDurationSeconds || 0);
  if (targetDuration > 0 && Math.abs(totalDurationSeconds - targetDuration) > 0.01) {
    fail(`Segment durations total ${totalDurationSeconds}s but project targetDurationSeconds is ${targetDuration}s.`);
  }

  const artifacts = [
    ['scriptVerbatimSource', 'script-verbatim.txt'],
    ['storyboardExecutionSource', 'storyboard-execution.txt'],
    ['tscHandoffSource', 'tsc-handoff.yaml'],
    ['promptSource', 'prompt.txt'],
  ];
  const missing = Object.fromEntries(artifacts.map(([, label]) => [label, []]));
  for (const segment of config.segments) {
    for (const [field, label] of artifacts) {
      const value = segment[field];
      if (!value || !isFile(resolveFrom(options.projectRoot, value))) missing[label].push(segment.id);
    }
  }

  const report = {
    schemaVersion: 'auto-segment-progress/1.0',
    projectRoot: options.projectRoot,
    declaredSegments: ids.length,
    uniqueSegments: uniqueIds.size,
    totalDurationSeconds,
    targetDurationSeconds: targetDuration || null,
    missingArtifacts: Object.fromEntries(Object.entries(missing).map(([label, segmentIds]) => [label, { count: segmentIds.length, segmentIds }])),
    status: Object.values(missing).every((segmentIds) => segmentIds.length === 0) ? 'complete' : 'incomplete',
    auditedAt: new Date().toISOString(),
  };
  fs.writeFileSync(options.output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}

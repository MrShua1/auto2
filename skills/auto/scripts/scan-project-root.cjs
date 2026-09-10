#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function fail(message) { throw new Error(message); }

function parseArgs(argv) {
  const options = { projectRoot: '', output: 'project-inventory.json', force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scan-project-root.cjs --project-root <PROJECT_ROOT> [--output <path>] [--force]');
      process.exit(0);
    }
    if (arg === '--force') { options.force = true; continue; }
    if (!['--project-root', '--output'].includes(arg)) fail(`Unknown argument: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
    options[arg === '--project-root' ? 'projectRoot' : 'output'] = value;
  }
  if (!options.projectRoot) fail('--project-root <PROJECT_ROOT> is required.');
  options.projectRoot = path.resolve(options.projectRoot);
  options.output = path.isAbsolute(options.output) ? path.normalize(options.output) : path.resolve(options.projectRoot, options.output);
  return options;
}

function isInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function classify(relativePath, extension) {
  const normalized = relativePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const base = path.basename(lower);
  const parentSegments = path.posix.dirname(lower).split('/');
  const dedicatedScriptExtensions = new Set(['.fdx', '.fountain']);
  const generalDocumentExtensions = new Set(['.docx', '.doc', '.pdf', '.txt', '.md', '.rtf']);
  const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif', '.tif', '.tiff', '.avif']);
  const structuredExtensions = new Set(['.json', '.yaml', '.yml', '.csv', '.xlsx', '.xls', '.ods', '.tsv']);
  const scriptName = /剧本|脚本|分集|正文|故事|对白|台词|episode|screenplay|script|scenario|story|dialogue/.test(base)
    || parentSegments.some((segment) => /^(?:剧本|脚本|分集剧本|scripts?|screenplays?|scenarios?)$/.test(segment));
  const generatedTextName = /^(?:prompt|script-source|script-verbatim|storyboard-execution|script-coverage-report|episode-summary|episode-missing-assets|unique-missing-assets|分集说明|全片缺失素材|素材映射|script-preview)\.(?:txt|md)$/.test(base);
  const manifestName = /资产|素材|清单|manifest|asset[-_ ]?(?:list|bible|manifest)|reference/.test(lower);
  const wardrobeName = /服装|服饰|造型|妆造|衣橱|wardrobe|costume|styling/.test(lower);
  const categories = [];
  if (imageExtensions.has(extension)) categories.push('images');
  if (dedicatedScriptExtensions.has(extension) || (generalDocumentExtensions.has(extension) && scriptName && !generatedTextName)) categories.push('scripts');
  if (structuredExtensions.has(extension) && manifestName) categories.push('assetManifests');
  if (structuredExtensions.has(extension) && wardrobeName) categories.push('wardrobeTables');
  if (categories.length === 0 && !generatedTextName && (scriptName || manifestName || wardrobeName) && !base.startsWith('.')) categories.push('otherRelevantFiles');
  return categories;
}

function walk(root, outputPath) {
  const buckets = { scripts: [], images: [], assetManifests: [], wardrobeTables: [], otherRelevantFiles: [], scanErrors: [] };
  let filesScanned = 0;
  const visit = (directory) => {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
    catch (error) { buckets.scanErrors.push({ path: path.relative(root, directory), error: error.message }); return; }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (path.normalize(absolute).toLowerCase() === path.normalize(outputPath).toLowerCase()) continue;
      if (entry.isSymbolicLink()) {
        buckets.scanErrors.push({ path: path.relative(root, absolute), error: 'symbolic_link_not_followed' });
        continue;
      }
      if (entry.isDirectory()) { visit(absolute); continue; }
      if (!entry.isFile()) continue;
      filesScanned += 1;
      const relative = path.relative(root, absolute);
      const extension = path.extname(entry.name).toLowerCase();
      const categories = classify(relative, extension);
      if (categories.length === 0) continue;
      try {
        const stat = fs.statSync(absolute);
        const record = {
          path: relative,
          extension,
          bytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
          sha256: sha256(absolute),
        };
        for (const category of categories) buckets[category].push(record);
      } catch (error) {
        buckets.scanErrors.push({ path: relative, error: error.message });
      }
    }
  };
  visit(root);
  for (const key of ['scripts', 'images', 'assetManifests', 'wardrobeTables', 'otherRelevantFiles']) {
    buckets[key].sort((left, right) => left.path.localeCompare(right.path, 'zh-CN'));
  }
  return { filesScanned, ...buckets };
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.projectRoot) || !fs.statSync(options.projectRoot).isDirectory()) fail(`PROJECT_ROOT not found: ${options.projectRoot}`);
  if (!isInside(options.output, options.projectRoot)) fail('--output must remain inside PROJECT_ROOT.');
  if (fs.existsSync(options.output) && !options.force) fail(`Inventory already exists; use --force to replace it: ${options.output}`);
  const scan = walk(options.projectRoot, options.output);
  const inventory = {
    schemaVersion: 'auto-project-inventory/1.0',
    projectRoot: options.projectRoot,
    scannedAt: new Date().toISOString(),
    ...scan,
    status: scan.scanErrors.length === 0 ? 'complete' : 'complete_with_scan_errors',
  };
  const transaction = `${process.pid}.${Date.now()}`;
  const temporary = `${options.output}.${transaction}.tmp`;
  const backup = `${options.output}.${transaction}.bak`;
  let backedUp = false;
  try {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(temporary, `${JSON.stringify(inventory, null, 2)}\n`, 'utf8');
    if (fs.existsSync(options.output)) {
      fs.renameSync(options.output, backup);
      backedUp = true;
    }
    fs.renameSync(temporary, options.output);
    if (backedUp) fs.rmSync(backup, { force: true });
  } catch (error) {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    if (backedUp && !fs.existsSync(options.output) && fs.existsSync(backup)) fs.renameSync(backup, options.output);
    throw error;
  }
  console.log(JSON.stringify({ output: options.output, filesScanned: scan.filesScanned, scripts: scan.scripts.length, images: scan.images.length, assetManifests: scan.assetManifests.length, wardrobeTables: scan.wardrobeTables.length, scanErrors: scan.scanErrors.length }));
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
}

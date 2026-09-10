const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = __dirname;

function installTransaction(entries, target, backup, verify) {
  const journalPath = path.join(backup, 'transaction.json');
  const journal = { status: 'applying', target, entries: [] };
  const parents = [];
  function mkdir(dir) { if (!fs.existsSync(dir)) { mkdir(path.dirname(dir)); fs.mkdirSync(dir); parents.push(dir); } }
  const save = () => fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  fs.mkdirSync(backup, { recursive: true }); save();
  try {
    for (const entry of entries) {
      const dest = path.join(target, entry.rel); const old = path.join(backup, 'originals', entry.rel);
      const row = { rel: entry.rel, source: entry.source, hadOriginal: fs.existsSync(dest), backedUp: false, installed: false };
      journal.entries.push(row); save();
      mkdir(path.dirname(dest));
      if (row.hadOriginal) { fs.mkdirSync(path.dirname(old), { recursive: true }); fs.renameSync(dest, old); row.backedUp = true; save(); }
      fs.renameSync(entry.source, dest); row.installed = true; save();
    }
    const result = verify();
    journal.status = 'committed'; save();
    return result;
  } catch (error) {
    const failures = [];
    for (const row of [...journal.entries].reverse()) {
      try {
        const dest = path.join(target, row.rel); const old = path.join(backup, 'originals', row.rel);
        if (row.installed) fs.rmSync(dest, { recursive: true, force: true });
        if (row.backedUp) fs.renameSync(old, dest);
      } catch (rollbackError) { failures.push(rollbackError.message); }
    }
    for (const dir of parents.reverse()) { try { fs.rmdirSync(dir); } catch { /* Retain nonempty/shared directories. */ } }
    journal.status = failures.length ? 'rollback_failed' : 'rolled_back'; journal.rollbackErrors = failures;
    try { save(); } catch (writeError) { failures.push(writeError.message); }
    throw Error(`Installation failed: ${error.message}; ${failures.length ? 'rollback incomplete, retain lock and restore from ' + backup : 'previous installation restored'}`);
  }
}

function install(targetArg) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('This bundle supports Windows x64 only');
  const target = path.resolve(targetArg || path.join(os.homedir(), '.config/opencode'));
  const normalized = p => path.resolve(p).toLowerCase();
  if (normalized(target) === normalized(root) || normalized(target).startsWith(normalized(root) + path.sep) || normalized(root).startsWith(normalized(target) + path.sep)) throw Error('Install target must not overlap the bundle');
  // Refuse links in the destination ancestry; a junction must not redirect backups/writes.
  for (let dir = target; ; dir = path.dirname(dir)) {
    if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw Error('Linked installation destination: ' + dir);
    if (dir === path.dirname(dir)) break;
  }
  const readiness = require('./check-auto-d.cjs').check();
  fs.mkdirSync(target, { recursive: true });
  const backupRoot = path.join(target, 'auto-d-backups');
  if (fs.existsSync(backupRoot) && fs.lstatSync(backupRoot).isSymbolicLink()) throw Error('Linked backup directory');
  const lock = path.join(target, '.auto-d-install-lock');
  const fd = fs.openSync(lock, 'wx');
  const backup = path.join(target, 'auto-d-backups', crypto.randomUUID());
  const staging = path.join(target, '.auto-d-staging-' + crypto.randomUUID());
  let keepLock = false;
  try {
    fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, backup, staging }));
    const entries = [];
    function copy(src, rel) { const dest = path.join(staging, rel); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.cpSync(path.join(root, src), dest, { recursive: true }); entries.push({ rel, source: dest }); }
    for (const name of ['auto', 'stx', 'multi-image-generation']) copy('skills/' + name, 'skills/' + name);
    copy('image-runtime', 'auto-d-runtime');
    fs.cpSync(path.join(root, 'runtimes'), path.join(staging, 'auto-d-runtime/runtimes'), { recursive: true });
    for (const dir of ['commands', 'agents']) for (const name of fs.readdirSync(path.join(root, dir))) copy(dir + '/' + name, (dir === 'commands' ? 'command' : 'agents') + '/' + name);
    fs.mkdirSync(path.join(staging, 'plugins'), { recursive: true });
    fs.writeFileSync(path.join(staging, 'plugins/fast-image.ts'), 'export { default } from "../auto-d-runtime/plugins/fast-image.ts"\n');
    entries.push({ rel: 'plugins/fast-image.ts', source: path.join(staging, 'plugins/fast-image.ts') });
    for (const entry of entries) for (let dir = path.join(target, entry.rel); normalized(dir) !== normalized(target); dir = path.dirname(dir)) {
      if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw Error('Linked installation destination: ' + dir);
    }
    const agents = path.join(target, 'AGENTS.md');
    if (fs.existsSync(agents) && fs.lstatSync(agents).isSymbolicLink()) throw Error('Linked AGENTS.md');
    const old = fs.existsSync(agents) ? fs.readFileSync(agents, 'utf8') : '';
    if (!old.includes('Auto D Delivery Policy')) {
      fs.writeFileSync(path.join(staging, 'AGENTS.md'), old + '\n\n# Auto D Delivery Policy\n\n' + fs.readFileSync(path.join(root, 'user-preferences.md'), 'utf8'));
      entries.push({ rel: 'AGENTS.md', source: path.join(staging, 'AGENTS.md') });
    }
    const run = (base, args, cwd) => {
      const r = spawnSync(path.join(base, 'auto-d-runtime/runtimes/bun.exe'), args, { cwd, encoding: 'utf8', windowsHide: true, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
      if (r.error || r.status !== 0) throw Error('Installed runtime check failed: ' + (r.error?.message || r.stdout + '\n' + r.stderr));
      return r.stdout;
    };
    run(staging, ['test', './fast-image.test.ts'], path.join(staging, 'auto-d-runtime'));
    const probe = base => JSON.parse(run(base, [path.join(root, 'probe-installed-plugin.mjs'), base], base));
    probe(staging);
    require('./check-auto-d.cjs').verifyIntegrity();
    const installedEntry = installTransaction(entries, target, backup, () => probe(target));
    return { installed: target, backup, offlineTestsPassed: true, installedEntry, readiness, requiredNext: 'Restart the actual OpenCode host once; if tools are absent run Diagnose.cmd.' };
  } catch (error) {
    keepLock = /rollback incomplete/.test(error.message);
    throw error;
  } finally {
    fs.closeSync(fd);
    if (!keepLock) { fs.rmSync(staging, { recursive: true, force: true }); fs.unlinkSync(lock); }
  }
}
module.exports = { installTransaction, install };
if (require.main === module) { try { console.log(JSON.stringify(install(process.argv[2]), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }

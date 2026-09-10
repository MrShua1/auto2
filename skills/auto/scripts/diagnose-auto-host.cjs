const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { summarize } = require('./host-config-evidence.cjs');
const root = __dirname;
const argv = process.argv.slice(2);
function arg(name, fallback) { const i = argv.indexOf(name); return i < 0 ? fallback : argv[i + 1]; }
const target = path.resolve(arg('--target', path.join(os.homedir(), '.config/opencode')));
const project = path.resolve(arg('--project', process.cwd()));
const report = { schema: 'auto-host-diagnostic/1', checkedAt: new Date().toISOString(), target, project, currentSessionToolExposure: 'UNKNOWN_NOT_MEASURED', apiTest: 'NOT_RUN', restartsInferred: false };
const quote = text => "'" + String(text).replaceAll("'", "''") + "'";
function cli(args) {
  const exe = arg('--opencode', 'opencode');
  return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& ${quote(exe)} ${args.map(quote).join(' ')}`], { cwd: project, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
}
report.pluginEntryExists = fs.existsSync(path.join(target, 'plugins/fast-image.ts'));
report.runtimeExists = fs.existsSync(path.join(target, 'auto-d-runtime/plugins/fast-image.ts'));
const bun = fs.existsSync(path.join(target, 'auto-d-runtime/runtimes/bun.exe')) ? path.join(target, 'auto-d-runtime/runtimes/bun.exe') : path.join(root, 'runtimes/bun.exe');
const probe = spawnSync(bun, [path.join(root, 'probe-installed-plugin.mjs'), target], { encoding: 'utf8', timeout: 30000, windowsHide: true });
try { report.installedEntry = JSON.parse(probe.stdout); } catch { report.installedEntry = { status: 'unavailable', exitCode: probe.status, error: probe.error?.code || 'Probe output unavailable; no raw logs exported' }; }
report.environment = Object.fromEntries(['OPENCODE_PURE', 'OPENCODE_DISABLE_DEFAULT_PLUGINS', 'OPENCODE_DISABLE_PROJECT_CONFIG'].map(k => [k, process.env[k] || null]));
report.configOverridesPresent = ['OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR', 'OPENCODE_CONFIG_CONTENT'].filter(k => process.env[k]);
const version = cli(['--version']);
report.cliVersion = version.status === 0 ? version.stdout.trim().slice(0, 100) : 'UNAVAILABLE';
const paths = cli(['debug', 'paths']);
const configPathMatch = (paths.stdout || '').match(/^config\s+(.+)$/m);
report.cliConfigRoot = configPathMatch?.[1]?.trim() || 'UNKNOWN';
report.cliConfigRootMatchesTarget = report.cliConfigRoot === 'UNKNOWN' ? null : path.resolve(report.cliConfigRoot).toLowerCase() === target.toLowerCase();
const result = cli(['debug', 'config']);
try {
  if (result.status !== 0) throw Error('Host debug config failed');
  const config = JSON.parse(result.stdout);
  report.hostConfig = summarize(config, target);
} catch {
  // Never export raw config/stderr: it can contain provider keys and authorization headers.
  report.hostConfig = { status: 'unavailable', exitCode: result.status, error: result.error?.code || 'DEBUG_CONFIG_FAILED_OR_UNSUPPORTED', safeLogHints: [...new Set((result.stderr || '').match(/ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND|ConfigInvalidError|PluginLoadError|SyntaxError|ENOENT|EACCES/gi) || [])] };
}
report.nextActions = [];
if (report.cliConfigRootMatchesTarget === false) report.nextActions.push('The CLI config root differs from the installation target. Check the actual host root; do not assume this standalone installation is active.');
if (report.installedEntry?.installedEntryImport !== 'passed') report.nextActions.push('Fix the installed wrapper/module import error before restarting; offline implementation tests alone are insufficient.');
if (report.hostConfig?.fastImageDiscovered === false) report.nextActions.push('Check the actual desktop/remote host config root, config overrides and plugin-disable flags; a file under another user/config directory is not active registration.');
if (report.hostConfig?.unresolvedRelativePlugins) report.nextActions.push('Relative plugin entries lack source-config provenance in merged debug output. Resolve each against the directory of its declaring config; do not assume the installation target or project cwd is its base. Discovery remains unknown until that evidence is available.');
if (report.hostConfig?.toolDisabled || report.hostConfig?.agentToolDisabled || report.hostConfig?.permission === 'deny' || report.hostConfig?.agentToolPermission === 'deny') report.nextActions.push('Inspect the effective agent/tool permission policy. Do not silently weaken permissions.');
report.nextActions.push('CLI config evidence is not Desktop/API session evidence. Verify the exact host executable/version and current model tool list. Do not infer a failed restart from UNKNOWN or request repeated restarts without new evidence.');
const output = path.resolve(arg('--out', path.join(os.tmpdir(), 'auto-host-diagnostic.json')));
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, reportPath: output }, null, 2));
if (report.installedEntry?.installedEntryImport !== 'passed') process.exitCode = 1;

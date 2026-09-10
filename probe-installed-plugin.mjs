import { pathToFileURL } from 'node:url';
import path from 'node:path';
const target = path.resolve(process.argv[2]);
let hooks;
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw Error('Network is disabled during installation probe'); };
try {
  const entry = path.join(target, 'plugins/fast-image.ts');
  const module = await import(pathToFileURL(entry).href);
  if (typeof module.default !== 'function') throw Error('Plugin entry has no callable default export');
  hooks = await module.default({ client: {} }, { previewPort: 0 });
  if (!hooks.tool?.direct_image_run?.execute) throw Error('Plugin did not export direct_image_run');
  const config = { provider: {} };
  await hooks.config?.(config);
  if (!config.provider['direct-image']) throw Error('Provider hook did not register direct-image');
  const result = await hooks.tool.direct_image_run.execute({ route: 'invalid-offline-probe', prompt: 'offline validation only' }, {
    sessionID: 'installation-probe', messageID: 'installation-probe', agent: 'build',
    directory: target, worktree: target, abort: new AbortController().signal,
    metadata() {}, async ask() { throw Error('Unexpected permission request'); },
  });
  if (networkCalls || result.metadata?.providerRequests !== 0) throw Error('Probe unexpectedly attempted a provider call');
  console.log(JSON.stringify({ installedEntryImport: 'passed', toolExport: 'direct_image_run', providerHook: 'passed', offlineValidation: 'passed', providerRequests: 0, currentSessionToolExposure: 'NOT_OBSERVABLE_FROM_SUBPROCESS' }));
} catch (error) {
  console.log(JSON.stringify({ installedEntryImport: 'failed', error: error.message, providerRequests: networkCalls }));
  process.exitCode = 1;
} finally { await hooks?.dispose?.(); }

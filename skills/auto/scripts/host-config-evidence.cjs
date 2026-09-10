const path = require('node:path');
const { fileURLToPath } = require('node:url');
function summarize(config, target, { configBase } = {}) {
  const plugins = Array.isArray(config.plugin) ? config.plugin : [];
  const normalize = p => path.resolve(p).replaceAll('\\', '/').toLowerCase();
  const expected = normalize(path.join(target, 'plugins/fast-image.ts'));
  let unresolvedRelativePlugins = 0;
  const paths = plugins.map(p => Array.isArray(p) ? p[0] : p).flatMap(p => {
    if (typeof p !== 'string') return [];
    try {
      if (p.startsWith('file:')) p = fileURLToPath(p);
      if (/^\.\.?[\\/]/.test(p)) {
        if (!configBase) { unresolvedRelativePlugins++; return []; }
        p = path.resolve(configBase, p);
      }
      return path.isAbsolute(p) ? [normalize(p)] : [];
    } catch { return []; }
  });
  const permission = p => typeof p === 'string' ? p : p ? 'PATTERN_RULE_REQUIRES_REVIEW' : 'UNSPECIFIED';
  const agent = config.agent?.[config.default_agent || 'build'];
  return {
    status: 'read', pluginCount: plugins.length,
    fastImageDiscovered: paths.includes(expected) ? true : unresolvedRelativePlugins ? null : false,
    unresolvedRelativePlugins,
    otherFastImageEntryDiscovered: paths.some(p => p !== expected && p.endsWith('/plugins/fast-image.ts')),
    directImageProviderVisible: !!config.provider?.['direct-image'],
    defaultAgent: config.default_agent || 'build',
    toolDisabled: config.tools?.direct_image_run === false,
    permission: permission(typeof config.permission === 'string' ? config.permission : config.permission?.direct_image_run),
    agentToolDisabled: agent?.tools?.direct_image_run === false,
    agentToolPermission: permission(typeof agent?.permission === 'string' ? agent.permission : agent?.permission?.direct_image_run),
  };
}
module.exports = { summarize };

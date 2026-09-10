#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { resolveProductionProfile } = require('./lib/production-profile.cjs');

const projectRoot = path.resolve(process.env.AUTO_PROJECT_ROOT || process.cwd());
const segmentId = process.env.AUTO_SEGMENT || '';
const defaults = {
  enableSound: 'on',
  count: '1',
};

function isInside(candidate, root) {
  const rootPath = path.resolve(root).replace(/[\\/]$/, '') + path.sep;
  return path.resolve(candidate).toLowerCase().startsWith(rootPath.toLowerCase());
}

function fail(message) {
  throw new Error(message);
}

function printHelp() {
  console.log(`用法：
  node generate-segment-libtv.cjs --project <画布UUID> --segment SEG001 [选项]

默认行为：预检，不上传、不创建节点、不生成视频。
--run                    执行上传、连线、视频节点创建并同步等待生成。
--project <UUID>         目标 LibTV 画布 UUID；--run 时必填。
--segment <SEG###>       Auto 片段 ID；也可使用 AUTO_SEGMENT 环境变量。
--project-root <路径>    Auto 项目根目录；默认当前目录。
--model-key <key>        模型 key；默认读取项目配置。
--model-name <名称>      模型显示名；默认读取项目配置。
--resolution <值>        模型分辨率枚举值；默认读取项目配置。
--group <名称或ID>       LibTV 普通分组。
--name <节点名>          视频节点名；默认由片段、模型、分辨率和画幅生成。
--help                   显示帮助。

模型、模式、分辨率、画幅、声音和输出数均以 episode-package-config.json 为准。`);
}

function parseArgs(argv) {
  const options = {
    run: false,
    project: '',
    segment: segmentId,
    projectRoot,
    modelKey: '',
    modelName: '',
    resolution: '',
    group: '',
    name: '',
    explicit: new Set(),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--run') {
      options[arg.slice(2)] = true;
      continue;
    }
    const valueFlags = ['--project', '--segment', '--project-root', '--model-key', '--model-name', '--resolution', '--group', '--name'];
    if (valueFlags.includes(arg)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) fail(`${arg} 需要一个值。`);
      const optionNames = {
        '--project': 'project',
        '--segment': 'segment',
        '--project-root': 'projectRoot',
        '--model-key': 'modelKey',
        '--model-name': 'modelName',
        '--resolution': 'resolution',
        '--group': 'group',
        '--name': 'name',
      };
      options[optionNames[arg]] = value;
      options.explicit.add(optionNames[arg]);
      continue;
    }
    fail(`未知参数：${arg}`);
  }
  if (!/^SEG\d{3}$/i.test(options.segment)) fail('--segment 必须是 SEG###。');
  options.segment = options.segment.toUpperCase();
  return options;
}

function loadConfig(options) {
  const configPath = path.join(options.projectRoot, 'episode-package-config.json');
  if (!fs.existsSync(configPath)) fail(`缺少配置文件：${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  const videoBackend = config.videoBackend || 'libtv';
  if (videoBackend !== 'libtv') fail(`This package uses videoBackend=${videoBackend}; select and validate LibTV before using generate-segment-libtv.cjs.`);
  const profile = resolveProductionProfile(config);
  if (!['draft_model_neutral', 'final_prevideo'].includes(config.packageMode)) fail('配置必须声明 draft_model_neutral 或 final_prevideo packageMode。');
  const settings = {
    modelKey: config.targetModelKey,
    modelName: config.targetModel,
    modeType: config.modeType,
    resolution: config.resolution,
    ratio: config.aspectRatio,
    enableSound: config.enableSound === false ? 'off' : 'on',
    count: String(config.outputCount || defaults.count),
  };
  for (const [key, value] of Object.entries(settings)) {
    if (key !== 'enableSound' && key !== 'count' && (typeof value !== 'string' || !value.trim())) fail(`配置缺少视频设置：${key}`);
    if (['auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion) && typeof value === 'string' && /REQUIRED(?:_|$)/i.test(value)) fail(`视频设置仍包含模板占位符：${key}`);
  }
  for (const key of ['modelKey', 'modelName', 'resolution']) {
    if (!options.explicit.has(key)) options[key] = settings[key];
  }
  if (!options.name) options.name = `${options.segment}-${settings.modelName.replace(/\s+/g, '')}-${settings.resolution}-${settings.ratio.replace(':', 'x')}`;
  const segment = config.segments?.find((item) => item.id === options.segment);
  if (!segment) fail(`配置中找不到 ${options.segment}。`);
  if (!segment.durationSeconds || segment.durationSeconds < Number(config.segmentDurationMinimumSeconds) || segment.durationSeconds > Number(config.segmentDurationMaximumSeconds)) {
    fail(`${options.segment} 的时长不在项目配置范围内。`);
  }
  const promptPath = path.resolve(options.projectRoot, segment.promptSource);
  if (!isInside(promptPath, options.projectRoot)) fail(`${options.segment} prompt path must remain inside project root.`);
  if (!fs.existsSync(promptPath)) {
    fail(`缺少最终 TSC 提示词：${promptPath}。必须先由 TSC 按固定格式生成 prompt.txt。`);
  }
  const prompt = fs.readFileSync(promptPath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (profile.prompt.shotFormat === 'numbered_fields_v1') {
    const { validatePrompt } = require('./validate-video-prompts.cjs');
    const current = validatePrompt(config, profile, segment, prompt);
    if (segment.sameSceneAsPrevious) {
      const previous = config.segments[config.segments.indexOf(segment) - 1];
      if (!previous) fail('Continuing segment has no predecessor.');
      const previousText = fs.readFileSync(path.resolve(options.projectRoot, previous.promptSource), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
      if (validatePrompt(config, profile, previous, previousText).endingSnapshot !== current.inheritedSnapshot) fail('Physical opening state differs from the predecessor ending state.');
    }
    settings.packageMode = config.packageMode;
    return { config, profile, segment, prompt, settings };
  }
  const requiredSections = config.layout?.promptFixedSections || ['【角色清单】', '【资源引用】', '【场景】', '【站位与起始状态】', '【结束状态】'];
  for (const section of requiredSections) {
    if (!prompt.includes(section)) fail(`${options.segment} 提示词缺少固定字段 ${section}。`);
  }
  const phaseCount = (prompt.match(/【[0-9]+(?:\.[0-9]+)?—[0-9]+(?:\.[0-9]+)?秒】/g) || []).length;
  if (phaseCount < profile.prompt.timedPhaseMinimum || phaseCount > profile.prompt.timedPhaseMaximum) fail(`${options.segment} 必须包含 ${profile.prompt.timedPhaseMinimum}-${profile.prompt.timedPhaseMaximum} 个连续时间字段，当前为 ${phaseCount} 个。`);
  const durationPrefix = config.layout?.promptDurationPrefix || '生成时长：';
  const durationSuffix = config.layout?.promptDurationSuffix || '秒。';
  if (!prompt.startsWith(`${durationPrefix}${segment.durationSeconds}${durationSuffix}`)) {
    fail(`${options.segment} 提示词首行时长与配置不一致。`);
  }
  const visualAssets = (segment.assets || []).filter((asset) => ['character', 'location', 'prop'].includes(asset.assetType));
  for (const [index, asset] of visualAssets.entries()) {
    const mixedNumber = (asset.mixedToken.match(/\d+/) || [])[0];
    const subjectName = `主体${mixedNumber}`;
    if (!new RegExp(`把 ${asset.mixedToken.replace(/[{}]/g, '\\$&')} 中[\\s\\S]*?作为${subjectName}`).test(prompt.split('【资源引用】')[0])) {
      fail(`${options.segment} 未在【角色清单】中将 ${asset.mixedToken} 定义为 ${subjectName}。`);
    }
  }
  if (/CHAR\d{3}|角色锁|各角色|主体\d+-主体\d+/.test(prompt)) {
    fail(`${options.segment} 提示词包含旧角色别名或未归一化主体别名。`);
  }
  if ((prompt.match(/主体锁：/g) || []).length < phaseCount) {
    fail(`${options.segment} 每个时间镜头都必须包含主体锁。`);
  }
  if (prompt.split(profile.prompt.endingPolicy).length !== 2) {
    fail(`${options.segment} 必须包含且只能包含一次项目配置的结束策略。`);
  }
  if (/\bC\d{3}\b|\bSHOT\d{3,}\b|秒｜镜头\d+|\bclipId\b/i.test(prompt)) {
    fail(`${options.segment} 提示词包含只应存在于审计文件中的内部编号。`);
  }
  if (profile.prompt.stateChangeContract === 'explicit_pre_action_ordered_action_post_action') {
    for (const marker of ['动作前状态：', '动作顺序：', '动作后状态：']) {
      if (!prompt.includes(marker)) fail(`${options.segment} 提示词缺少状态变化字段 ${marker}。`);
    }
  }
  if (profile.look.styleSuffix && !prompt.endsWith(profile.look.styleSuffix)) {
    fail(`${options.segment} 提示词未以配置的视觉风格后缀结尾。`);
  }
  if (/\{\{TailFrame\}\}|tail[-_ ]frame/i.test(prompt)) {
    fail(`${options.segment} 提示词包含已废弃的视频尾帧输入；请改用文字结束状态继承。`);
  }
  const inheritedSnapshot = prompt.match(/^继承连续性快照：([^\r\n]+)/m)?.[1];
  if (inheritedSnapshot) {
    const segmentIndex = config.segments.findIndex((item) => item.id === options.segment);
    const previousSegment = config.segments[segmentIndex - 1];
    if (!previousSegment) fail(`${options.segment} 声明继承连续性快照，但配置中没有上一片段。`);
    const previousPromptPath = path.resolve(options.projectRoot, previousSegment.promptSource);
    if (!fs.existsSync(previousPromptPath)) fail(`缺少上一片段提示词：${previousPromptPath}`);
    const previousPrompt = fs.readFileSync(previousPromptPath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const previousSnapshot = previousPrompt.match(/^连续性快照：([^\r\n]+)/m)?.[1];
    if (!previousSnapshot || previousSnapshot !== inheritedSnapshot) {
      fail(`${options.segment} 的起始连续性快照与 ${previousSegment.id} 的结束快照不完全一致。`);
    }
  }
  settings.packageMode = config.packageMode;
  return { config, profile, segment, prompt, settings };
}

function mediaType(asset) {
  if (['character_voice', 'environment_audio', 'sound_effect'].includes(asset.assetType)) return 'audio';
  return 'image';
}

function loadAssets(options, segment, config) {
  const allowedAssetTypes = new Set(['character', 'location', 'prop', 'character_voice', 'environment_audio', 'sound_effect']);
  const assets = (segment.assets || []).map((asset, index) => {
    if (!allowedAssetTypes.has(asset.assetType)) fail(`素材 ${asset.mixedToken} 使用非法资产类型：${asset.assetType}`);
    const source = path.resolve(options.projectRoot, asset.source);
    if (!isInside(source, options.projectRoot)) fail(`素材 ${asset.mixedToken} 必须位于项目根目录内：${asset.source}`);
    if (!fs.existsSync(source)) fail(`素材 ${asset.mixedToken} 不存在：${source}`);
    return {
      ...asset,
      source,
      index: index + 1,
      mediaType: mediaType(asset),
      nodeName: `${segment.id}-M${String(index + 1).padStart(2, '0')}-${asset.role}`,
    };
  });
  return assets;
}

function runLibTV(args, cwd) {
  const result = spawnSync('libtv', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: false,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) fail(`无法启动 libtv：${result.error.message}`);
  if (result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    fail(`libtv ${args.join(' ')} 失败${details ? `：\n${details}` : '。'}`);
  }
  const output = result.stdout.trim();
  const documents = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < output.length; index += 1) {
    const character = output[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === '{' || character === '[') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === '}' || character === ']') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        try { documents.push(JSON.parse(output.slice(start, index + 1))); } catch { /* ignore log fragments */ }
        start = -1;
      }
    }
  }
  return { value: documents.at(-1) || null, stdout: result.stdout, stderr: result.stderr };
}

function projectArgs(options) {
  return ['-p', options.project, ...(options.group ? ['-g', options.group] : [])];
}

function isAudioAuditTimeout(error) {
  return /音频审核超时|audio.*audit.*timeout|audio.*review.*timeout/i.test(error.message);
}

function removeAudioReference(prompt, asset) {
  const token = asset.mixedToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const clause = new RegExp(`把\\s*${token}\\s*仅作为[^；。]*[；。]?`, 'g');
  const withoutClause = prompt.replace(clause, '');
  return withoutClause === prompt ? prompt.replaceAll(asset.mixedToken, '') : withoutClause;
}

function plan(options, segment, assets, prompt, settings) {
  console.log(JSON.stringify({
    segmentId: segment.id,
    project: options.project || null,
    runRequested: options.run,
    targetModel: options.modelName,
    modelKey: options.modelKey,
    modeType: settings.modeType,
    resolution: options.resolution,
    ratio: settings.ratio,
    durationSeconds: segment.durationSeconds,
    enableSound: settings.enableSound,
    videoNodeName: options.name,
    assetOrder: assets.map((asset) => ({ mixedToken: asset.mixedToken, mediaType: asset.mediaType, role: asset.role, source: path.relative(options.projectRoot, asset.source), nodeName: asset.nodeName })),
    promptLength: prompt.length,
    status: options.run ? 'preflight_passed' : 'dry_run_only',
  }, null, 2));
}

function execute(options, segment, assets, prompt, settings) {
  if (settings.packageMode !== 'final_prevideo') fail('只有 final_prevideo 包可执行 LibTV 视频副作用。');
  if (!options.project) fail('--run 必须同时提供 --project <画布UUID>。');
  if (!/^[0-9a-f]{32}$/i.test(options.project)) fail('--project 必须是 32 位画布 UUID。');
  const statePath = path.join(options.projectRoot, 'auto-state.json');
  if (!fs.existsSync(statePath)) fail('执行视频前必须存在 auto-state.json，并明确授权视频副作用。');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''));
  if (state.control?.mode === 'episode_prevideo' || state.control?.videoSideEffectsAllowed !== true) {
    fail('当前 Auto 状态未授权视频副作用；/分集 永远不能执行 --run。');
  }
  if (state.video?.authorization?.status !== 'authorized' || !state.video.authorization.explicitCommand || !state.video.authorization.authorizedAt) {
    fail('视频执行需要本次项目的明确生成视频命令及授权时间；完成资产和提示词不等于视频授权。');
  }
  if (state.preVideoDelivery?.status !== 'complete') fail('视频执行前必须先完成完整预视频交付验收。');
  const outputCount = Number(settings.count);
  if (!Number.isSafeInteger(outputCount) || outputCount < 1 || !Number.isSafeInteger(state.budget?.videoUsed) || state.budget.videoUsed < 0 || !Number.isSafeInteger(state.budget?.videoLimit) || state.budget.videoUsed + outputCount > state.budget.videoLimit) fail('视频预算不足、未设置或输出数量无效。');
  const configPath = path.join(options.projectRoot, 'episode-package-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8').replace(/^\uFEFF/, ''));
  require('./lib/content-review.cjs').validateContentReview({ root: options.projectRoot, configPath, config, state });
  runLibTV(['account', 'info'], options.projectRoot);
  const model = runLibTV(['model', options.modelKey], options.projectRoot).value;
  if (model?.schema?.modelName && model.schema.modelName !== options.modelName) {
    fail(`实时模型名称不匹配：${options.modelKey} 返回 ${model.schema.modelName}，请求为 ${options.modelName}。`);
  }
  const schema = model?.schema;
  const modeRange = schema?.properties?.modeType?.items?.[settings.modeType];
  const mixed = schema?.mixed2videoConfig || schema?.properties?.modeType?.mixed2videoConfig;
  if (!modeRange || assets.length < Number(modeRange[0]) || assets.length > Number(modeRange[1]) || !mixed || mixed.imageMax < assets.filter((asset) => asset.mediaType === 'image').length || mixed.audioMax < assets.filter((asset) => asset.mediaType === 'audio').length) {
    fail('实时模型 schema 不满足本段图片或音频参考数量。');
  }
  if (schema?.properties?.modeType?.items && !schema.properties.modeType.items[settings.modeType]) fail(`实时模型不支持 ${settings.modeType}。`);
  if (!schema?.properties?.resolution?.enum?.some((item) => (item.value || item) === options.resolution)) fail(`实时模型不支持 ${options.resolution}。`);
  if (!schema?.properties?.ratio?.enum?.some((item) => (item.value || item) === settings.ratio)) fail(`实时模型不支持 ${settings.ratio}。`);
  if (schema?.properties?.duration?.enum && !schema.properties.duration.enum.some((item) => Number(item.value || item) === Number(segment.durationSeconds))) fail(`实时模型不支持 ${segment.durationSeconds} 秒。`);

  const currentProject = runLibTV(['project', options.project], options.projectRoot).value;
  const existingVideo = currentProject?.nodes?.find((node) => node.name === options.name && node.type === 'video');
  if (existingVideo) {
    const details = runLibTV(['node', existingVideo.id, '-p', options.project], options.projectRoot).value;
    if (details?.data?.url?.length) {
      console.log(JSON.stringify({ segmentId: segment.id, videoNode: details, status: 'existing_generation_already_complete' }, null, 2));
      return;
    }
    fail(`视频节点 ${options.name} 已存在但尚未完成；为避免重复付费生成，请先处理该节点或使用新的 --name。`);
  }

  const nodeKeys = [];
  const reservation = require('./lib/video-budget.cjs').reserveVideo(statePath, outputCount, `${options.project}:${options.name}`);
  const nodeKeyByToken = new Map();
  const skippedAudioAssets = [];
  for (const asset of assets) {
    const existing = currentProject?.nodes?.find((node) => node.name === asset.nodeName && node.type === asset.mediaType);
    let response;
    if (existing) {
      response = existing;
    } else {
      try {
        response = runLibTV(['upload', asset.nodeName, ...projectArgs(options), '--resource', asset.source, '--type', asset.mediaType], options.projectRoot).value;
      } catch (error) {
        if (asset.mediaType !== 'audio' || !isAudioAuditTimeout(error)) throw error;
        skippedAudioAssets.push(asset);
        console.error(`警告：${asset.role} 音色审核超时，本次不等待审核并继续生成视频。`);
        continue;
      }
    }
    const nodeKey = response?.nodeKey || response?.newNodeKey || response?.id;
    if (!nodeKey) fail(`素材 ${asset.mixedToken} 上传后没有返回 nodeKey。`);
    nodeKeys.push(nodeKey);
    nodeKeyByToken.set(asset.mixedToken, nodeKey);
  }

  let resolvedPrompt = prompt;
  for (const asset of assets) {
    if (skippedAudioAssets.includes(asset)) {
      resolvedPrompt = removeAudioReference(resolvedPrompt, asset);
      continue;
    }
    resolvedPrompt = resolvedPrompt.replaceAll(asset.mixedToken, `{{Node ${nodeKeyByToken.get(asset.mixedToken)}}}`);
  }
  if (skippedAudioAssets.length) {
    resolvedPrompt += '\n音色参考审核未完成的说话人不绑定外部音色节点；保持视频声音开启，按对白归属生成声音。';
  }
  const createArgs = [
    'node', 'create', options.name,
    ...projectArgs(options),
    '--type', 'video',
    '--prompt', resolvedPrompt,
    '--set', `model=${options.modelName}`,
    '--set', `modeType=${settings.modeType}`,
    '--set', `count=${settings.count}`,
    '--set', `ratio=${settings.ratio}`,
    '--set', `resolution=${options.resolution}`,
    '--set', `duration=${segment.durationSeconds}`,
    '--set', `enableSound=${settings.enableSound}`,
    ...nodeKeys.flatMap((nodeKey) => ['--left', nodeKey]),
  ];
  if (options.run) createArgs.push('--run');
  const result = runLibTV(createArgs, options.projectRoot).value;
  console.log(JSON.stringify({
    segmentId: segment.id,
    videoNode: result,
    budgetReservation: reservation.id,
    skippedAudioAuditAssets: skippedAudioAssets.map((asset) => asset.role),
    status: options.run ? 'generation_finished' : 'node_created_without_generation',
  }, null, 2));
}

try {
  const options = parseArgs(process.argv.slice(2));
  const loaded = loadConfig(options);
  const assets = loadAssets(options, loaded.segment, loaded.config);
  plan(options, loaded.segment, assets, loaded.prompt, loaded.settings);
  if (options.run) execute(options, loaded.segment, assets, loaded.prompt, loaded.settings);
} catch (error) {
  console.error(`错误：${error.message}`);
  process.exitCode = 1;
}

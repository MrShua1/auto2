#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { resolveProductionProfile } = require('./lib/production-profile.cjs');
const { validateDuration, validateKnownDefects, isStandaloneAlias } = require('./lib/content-review.cjs');
const { shotsOf, validateTiming, validateFields, validateAction, validateSubjects, validateSound, physicalStates, NUMBERED_FORMAT } = require('./lib/shot-format.cjs');

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const options = { projectRoot: process.cwd(), config: 'episode-package-config.json' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  node validate-video-prompts.cjs [--project-root <path>] [--config <path>]

Validates every configured source prompt without generating, uploading or modifying files.`);
      process.exit(0);
    }
    if (arg !== '--project-root' && arg !== '--config') fail(`Unknown argument: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
    options[arg === '--project-root' ? 'projectRoot' : 'config'] = value;
  }
  options.projectRoot = path.resolve(options.projectRoot);
  options.config = path.isAbsolute(options.config)
    ? options.config
    : path.resolve(options.projectRoot, options.config);
  return options;
}

function readText(filePath, label) {
  if (!fs.existsSync(filePath)) fail(`Missing ${label}: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getPromptSections(config) {
  const configured = config.layout?.promptFixedSections || config.promptFixedSections;
  if (configured) {
    if (!Array.isArray(configured) || (configured.length !== 5 && configured.length !== 4)) {
      fail('Config must define exactly 4 or 5 promptFixedSections.');
    }
    return configured;
  }
  return [
    '【角色清单】',
    '【资源引用】',
    '【场景】',
    '【站位与起始状态】',
    '【结束状态】',
  ];
}

function getCharacterAliasEntries(config, assets) {
  const characterAssets = assets.filter((item) => item.assetType === 'character');
  if (!Array.isArray(config.promptCharacterAliases)) fail('Config must define promptCharacterAliases as an array.');
  if (characterAssets.length > 0 && config.promptCharacterAliases.length === 0) fail('Character assets require promptCharacterAliases.');
  const entries = new Map();
  for (const entry of config.promptCharacterAliases) {
    if (!entry || typeof entry.characterName !== 'string' || !entry.characterName.trim() || !Array.isArray(entry.promptAliases) || entry.promptAliases.length === 0) {
      fail('Every promptCharacterAliases entry requires characterName and promptAliases.');
    }
    const aliases = [...new Set([entry.characterName, ...entry.promptAliases].filter((item) => typeof item === 'string' && item.trim()))];
    if (aliases.length !== entry.promptAliases.length + (entry.promptAliases.includes(entry.characterName) ? 0 : 1)) {
      fail(`Duplicate prompt aliases for ${entry.characterName}.`);
    }
    if (entries.has(entry.characterName)) fail(`Duplicate promptCharacterAliases characterName: ${entry.characterName}.`);
    entries.set(entry.characterName, aliases);
  }
  for (const asset of characterAssets) {
    if (typeof asset.characterName !== 'string' || !asset.characterName.trim() || !Array.isArray(asset.promptAliases) || asset.promptAliases.length === 0) {
      fail(`Character asset ${asset.mixedToken} requires characterName and promptAliases.`);
    }
    const configuredAliases = entries.get(asset.characterName);
    if (!configuredAliases || !asset.promptAliases.every((alias) => configuredAliases.includes(alias))) {
      fail(`Character asset ${asset.mixedToken} aliases are not registered for ${asset.characterName}.`);
    }
  }
  return [...entries.values()].flat();
}

function assertNamesOnlyInAllowedSpans(prompt, sectionStart, aliases, context) {
  let remainder = prompt.slice(sectionStart);
  remainder = remainder.replace(/[“”‘’"'][^“”‘’"']*[“”‘’"']/g, (match) => ' '.repeat(match.length));
  remainder = remainder.replace(/\[线稿图对应关系：[^\]]+\]/g, (match) => ' '.repeat(match.length));
  const voiceClause = /把\s+\{\{Mixed\s+\d+\}\}\s+仅作为[^；。\n]*(?:音色|声音)[^；。\n]*[；。]?/g;
  remainder = remainder.replace(voiceClause, (match) => ' '.repeat(match.length));
  remainder = remainder.replace(/(?:画外声音|电话声音|内心声音|现场齐声|线上弹幕)[（(][^）)]+[）)]/g, (match) => ' '.repeat(match.length));
  const forbidden = [...new Set(aliases)].sort((left, right) => right.length - left.length);
  for (const alias of forbidden) {
    if (isStandaloneAlias(remainder, alias)) {
      fail(`${context} uses character name or alias outside a voice-ownership clause or quoted dialogue: ${alias}`);
    }
  }
}

function validatePrompt(config, profile, segment, prompt) {
  const context = segment.id || segment.folder;
  validateKnownDefects(prompt, context, segment);
  const numberedFormat = profile.prompt.shotFormat === NUMBERED_FORMAT;
  const duration = Number(segment.durationSeconds);
  if (!Number.isFinite(duration) || duration <= 0) fail(`${context} has an invalid durationSeconds.`);
  const prefix = config.layout?.promptDurationPrefix || '生成时长：';
  const suffix = config.layout?.promptDurationSuffix || '秒。';
  if (!prompt.startsWith(`${prefix}${duration}${suffix}`)) {
    fail(`${context} prompt duration does not match durationSeconds.`);
  }

  const sections = getPromptSections(config);
  let cursor = -1;
  for (const section of sections) {
    if (section === '【资源引用】' && !prompt.includes('【资源引用】')) {
      // Rule 0.24: 【资源引用】 is deprecated and can be omitted in favor of decoupled lineart & storyboard image workflow
      continue;
    }
    if (prompt.split(section).length !== 2) fail(`${context} must contain ${section} exactly once.`);
    const index = prompt.indexOf(section);
    if (index < 0 || index <= cursor) fail(`${context} prompt sections are missing or out of order: ${section}`);
    cursor = index;
  }

  const timed = shotsOf(prompt, segment);
  if (profile.prompt.requireShotDuration && timed.some((shot) => shot.durationSeconds === undefined)) fail(`${context} every shot heading must include its duration in seconds.`);
  if (!timed.length || timed.some((shot) => shot.numbered !== numberedFormat)) fail(`${context} shot headings do not match the locked format.`);
  if (timed.length < profile.prompt.timedPhaseMinimum || timed.length > profile.prompt.timedPhaseMaximum) {
    fail(`${context} must contain ${profile.prompt.timedPhaseMinimum}-${profile.prompt.timedPhaseMaximum} timed ranges for production profile ${profile.profileId}.`);
  }
  const startSectionEnd = prompt.indexOf('【站位与起始状态】');
  const endingSectionStart = prompt.indexOf('【结束状态】');
  if (timed[0].index <= startSectionEnd || timed.at(-1).index >= endingSectionStart) {
    fail(`${context} timed ranges must be between the starting and ending state sections.`);
  }
  validateTiming(timed, duration, context);
  // Rule 0.21 Check: Zero Wardrobe Declaration in Staging Gate
  const stagingMatch = prompt.match(/【站位与起始状态】([\s\S]*?)(?:【|$)/);
  if (stagingMatch) {
    const stagingBody = stagingMatch[1];
    const forbiddenWardrobeRegex = /(?:身穿|穿着|穿戴|着装|佩戴|套着|工装|便服|长裤|短裤|短袖|长袖|衬衫|西装|T恤|旗袍|马甲|外衣|夹克)/;
    const match = stagingBody.match(forbiddenWardrobeRegex);
    if (match) {
      fail(`${context} violates Rule 0.21: 【站位与起始状态】 contains forbidden wardrobe declaration ("${match[0]}"). Wardrobe must be 100% defined by character reference image assets, zero clothing descriptions in staging.`);
    }
  }

  // Rule 0.22 Check: Zero Vague Relative Position Gate in Staging and Ending
  if (stagingMatch) {
    const stagingBody = stagingMatch[1];
    const matchVagueStaging = stagingBody.match(/(?:身侧|旁侧|身旁|旁边|在旁)/);
    if (matchVagueStaging) {
      fail(`${context} violates Rule 0.22: 【站位与起始状态】 contains forbidden vague relative position word ("${matchVagueStaging[0]}"). Must specify explicit screen coordinates ("画左", "画右", "主体X左侧/右侧半步").`);
    }
  }
  const endingMatch = prompt.match(/【结束状态】([\s\S]*?)(?:【|$)/);
  if (endingMatch) {
    const endingBody = endingMatch[1];
    const matchVagueEnding = endingBody.match(/(?:身侧|旁侧|身旁|旁边|在旁)/);
    if (matchVagueEnding) {
      fail(`${context} violates Rule 0.22: 【结束状态】 contains forbidden vague relative position word ("${matchVagueEnding[0]}"). Must specify explicit screen coordinates ("画左", "画右", "主体X左侧/右侧半步").`);
    }
  }

  // Rule 0.23 Check: Strict Zero Scene Visual Description Hallucination Gate
  const sceneSectionMatch = prompt.match(/【场景】([\s\S]*?)(?=【站位与起始状态】|【镜头|$)/);
  const locationAssets = (segment.assets || []).filter((item) => item.assetType === 'location');
  if (sceneSectionMatch && locationAssets.length > 0) {
    const sceneBody = sceneSectionMatch[1].trim();
    const forbiddenSceneProseRegex = /(?:残破|焦黑|木炭|房梁|砖瓦|木桩|满地|呼啸|质感|散落|断壁|残垣|泥沙|波光|开阔海口|海风穿堂|烈日当空|繁华大道|波涛|水体透彻|暗礁|珊瑚|人流|喧闹|拥挤|陈列|货架|高墙|深宅|阴冷|阴风|月朗星稀|月华|古意|沉香|红木家具|陈设|水光潋滟|阳光穿透|波浪拍打|光斑|手电筒|豪车|商务车|摇晃|摇曳|万道丁达尔|热浪|炙烤|烈日|晴空万里|人声鼎沸|街巷)/;
    const match = sceneBody.match(forbiddenSceneProseRegex);
    if (match) {
      fail(`${context} violates Rule 0.23: 【场景】 contains forbidden descriptive scene appearance/atmospheric prose ("${match[0]}"). When scene reference image asset is present, 【场景】 must strictly be a pure spatial reference (e.g. "主体N场景空间，日景自然光照。"), zero descriptive architectural or environmental prose.`);
    }
    if (sceneBody.length > 35) {
      fail(`${context} violates Rule 0.23: 【场景】 length (${sceneBody.length} chars) exceeds concise spatial reference limit. Must strictly be a pure spatial reference (e.g. "主体N场景空间，日景自然光照。"), zero descriptive architectural or environmental prose.`);
    }
  }

  // Rule 0.24 Check: Zero Frontal Portrait Prior Hijack in 【资源引用】
  if (prompt.includes('【资源引用】')) {
    const hasLineartWorkflow = prompt.includes('[线稿图对应关系：') || profile.prompt?.requireStoryboardImages === true;
    if (hasLineartWorkflow) {
      const resourceMatch = prompt.match(/【资源引用】([\s\S]*?)(?:【场景】|【站位与起始状态】)/);
      if (resourceMatch) {
        const resourceBody = resourceMatch[1];
        const forbiddenFrontalRegex = /(?:右上格提供正面服装|右下格提供背面发型|右下格提供背面服装|正面半身肖像|正面服装)/;
        const match = resourceBody.match(forbiddenFrontalRegex);
        if (match) {
          fail(`${context} violates Rule 0.24: 【资源引用】 contains forbidden frontal multi-view reference text ("${match[0]}"). Under Rule 0.24, multi-view reference text must be purged to eliminate frontal portrait prior hijack, and spatial staging is governed exclusively by lineart.`);
        }
      }
    }
  }

  const assets = segment.assets || [];
  const characterSubjectNumbers = assets
    .filter((item) => item.assetType === 'character')
    .map((item) => item.mixedToken.match(/\d+/)?.[0])
    .filter(Boolean);
  const characterRegex = characterSubjectNumbers.length > 0
    ? new RegExp(`主体(?:${characterSubjectNumbers.join('|')})\\b`)
    : /主体\d+/;
  const segmentAnchorDepths = new Map();
  let previousActionText = '';
  for (const [index, match] of timed.entries()) {
    const field = match.body;
    if (numberedFormat) {
      const fields = validateFields(match, `${context} shot ${index + 1}`);
      if (profile.prompt.stateChangeContract === 'explicit_pre_action_ordered_action_post_action') validateAction(fields.get('动作/表演'), `${context} shot ${index + 1}`);
      validateSound(fields.get('环境音/动作音'), profile, `${context} shot ${index + 1}`);

      const sceneText = fields.get('场景/时间/光线') || '';
      
      // Rule 0.23 Check: Shot-Level Strict Zero Scene Visual Description Hallucination Gate
      if (locationAssets.length > 0 && sceneText) {
        const forbiddenShotSceneProseRegex = /(?:残破|焦黑|木炭|房梁|砖瓦|木桩|满地|呼啸|质感|散落|断壁|残垣|阴天|阴影|散射|斑驳|写实光照|开阔海口|海风穿堂|烈日当空|繁华大道|波涛|水体透彻|暗礁|珊瑚|人流|喧闹|拥挤|陈列|货架|高墙|深宅|阴冷|阴风|月朗星稀|月华|古意|沉香|红木家具|陈设|水光潋滟|阳光穿透|波浪拍打|光斑|手电筒|豪车|商务车|摇晃|摇曳|万道丁达尔|热浪|炙烤|烈日|晴空万里|人声鼎沸|街巷|金光微曦|金光渐盛|晨浪|红日升起|宏大雄壮|大浪翻滚|水花激荡|晴朗日光|和煦阳光|阳光明媚|烈日初升|平坦浅滩|暗夜海面|海潮低沉|清晨朝霞|金红日光|金沙|热烈阳光|人声喧哗|明亮自然光|阳光灿烂|烈日炙烤|水泥地面|烈日高悬|奢华典雅|阳光普照|阴风惨惨|烈日暴晒|澄澈|大洋狂风|海浪激荡|深海水波|幽蓝微光|暗流涌动|百人瞩目|群情亢奋|群情激愤|黑烟|典雅庄重|沉香幽幽|繁华长街)/;
        const shotMatch = sceneText.match(forbiddenShotSceneProseRegex);
        if (shotMatch) {
          fail(`${context} shot ${index + 1} violates Rule 0.23: 场景/时间/光线 contains forbidden descriptive scene appearance/atmospheric prose ("${shotMatch[0]}"). When scene reference image asset is present, 场景/时间/光线 must strictly be a pure spatial reference (e.g. "主体N场景，日景自然光照。"), zero descriptive architectural or atmospheric prose.`);
        }
        if (sceneText.length > 25) {
          fail(`${context} shot ${index + 1} violates Rule 0.23: 场景/时间/光线 length (${sceneText.length} chars) exceeds concise limit (max 25 chars). Must strictly be a pure spatial reference (e.g. "主体N场景，日景自然光照。").`);
        }
      }

      const actionText = fields.get('动作/表演') || '';
      const framingText = fields.get('景别/拍摄/运镜') || '';
      const characterText = fields.get('人物') || '';
      const isSubjectivePOV = /主观(?:视角|视点|镜头)|POV|大俯角|俯瞰/i.test(framingText + ' ' + actionText);
      const visualDescription = (sceneText + ' ' + actionText + ' ' + framingText).replace(/[“"][^”"\n]*[”"]/g, '');
      const hasUnderwaterSeabed = /海底|水下(?:礁石|珊瑚|暗流|生物|海鱼|游鱼)/i.test(visualDescription);
      const hasSurfaceLand = /海滩|沙滩|陆地/i.test(visualDescription);
      if (hasUnderwaterSeabed && hasSurfaceLand) {
        const hasCharacterOnLand = /主体\d+/i.test(characterText) && /(?:平躺|站立|跪坐|站起身|立于|迈步|手抚|握)/i.test(actionText);
        if (hasCharacterOnLand) {
          fail(`${context} shot ${index + 1} violates Rule 0.13: cross-medium static double exposure (character physically present on land/beach while simultaneously rendering see-through underwater seabed). Decouple into objective reaction and subjective dive/underwater shots.`);
        }
        if (!isSubjectivePOV) {
          fail(`${context} shot ${index + 1} violates Rule 0.13: cross-medium transition from surface/beach to underwater requires an explicit subjective POV camera perspective.`);
        }
      }
      const isGazePenetration = /视线|看穿|透视|水眼金睛|瞳孔|主观(?:视角|视点)/i.test(framingText + ' ' + actionText);
      if (isGazePenetration && hasUnderwaterSeabed) {
        const hasPhysicalDisturbance = /(?:伴随.*浪花|气泡.*(?:划开|散去)|划开散去|破水.*飞溅|扎入水|水花炸裂|水体由.*(?:过渡|变))/i.test(actionText + ' ' + framingText + ' ' + visualDescription);
        if (hasPhysicalDisturbance) {
          fail(`${context} shot ${index + 1} violates Rule 0.13: gaze penetration mimics virtual sightline optical refocus, NOT physical splash/submersion! Strictly forbidden to hallucinate physical disturbance ("浪花与气泡向两侧划开散去", "水体由...过渡为...").`);
        }
      }

      // Rule 0.14 Check: Eyeline Causality & Gaze Trigger Gate
      if (isSubjectivePOV && index > 0) {
        const hasGazeTrigger = /转头|望向|看向|抬眼|凝视|视线|直视|注视|远眺/i.test(previousActionText + ' ' + actionText);
        if (!hasGazeTrigger) {
          fail(`${context} shot ${index + 1} violates Rule 0.14: unmotivated subjective POV cut! Prior objective shot or current shot must contain explicit physical gaze trigger ("转头面向...", "视线望向...", "直视...").`);
        }
      }

      // Rule 0.15 Check: Single-Scene Micro-Spatial Parity & Anti-Drift Gate
      const positionText = fields.get('位置承接') || '';
      const hasHallucinatedTerrain = /(?:最高礁石|沙坎(?:之巅|处)?|断崖(?:之上|之巅)?|绝壁|高台之巅)/i.test(positionText);
      if (hasHallucinatedTerrain && !/(?:走|跑|爬|登上|迈向).*(?:礁石|沙坎|断崖|高台)/i.test(actionText)) {
        fail(`${context} shot ${index + 1} violates Rule 0.15: hallucinated spatial terrain/elevation drift in 位置承接 ("${positionText}"). Character must preserve co-location parity unless walking/climbing action is explicit.`);
      }

      // Rule 0.16 Check: Facing Direction Hard Lock & Cross-Shot Orientation Inheritance Gate
      const hasCharacterInShot = characterRegex.test(characterText) && characterText !== '无' && !/第一人称主观|0人物|纯水下|纯画外/i.test(characterText);
      if (hasCharacterInShot) {
        const hasFacingDirection = /面朝|面向|背向|背对|朝向|身体朝|面部朝|直视|注视|仰卧|平躺|伏卧|俯视/i.test(positionText);
        if (!hasFacingDirection) {
          fail(`${context} shot ${index + 1} violates Rule 0.16: 位置承接 ("${positionText}") must explicitly declare character facing/body orientation ("面朝...", "身体与面部面向...", "背对..."), and inherit orientation from previous character shot.`);
        }
      }

      // Rule 0.17 Check: Physical Spatial Anchor & Depth Invariant Gate
      const hasVagueFloatingDirection = /(?:正前方|正后方|向前方|前方海面|面朝前方|面向前方|背朝后方|背向后方)/i.test(positionText);
      if (hasVagueFloatingDirection) {
        fail(`${context} shot ${index + 1} violates Rule 0.17: 位置承接 ("${positionText}") contains forbidden vague floating direction words ("正前方", "正后方", "向前方", "前方海面"). Must use physical anchor + depth layer (e.g. "面向深景处的远景大海", "背向近景细沙").`);
      }
      if (/(?:面朝正?前方|面向正?前方|走向正?前方|跑向正?前方|正前方海面|前方海面)/i.test(actionText)) {
        fail(`${context} shot ${index + 1} violates Rule 0.17: 动作/表演 ("${actionText}") contains forbidden vague floating direction words. Must anchor direction to physical entity and depth layer (e.g. "望向深景处的远景海面").`);
      }

      if (hasCharacterInShot) {
        const anchorMatches = [
          ...positionText.matchAll(/(远景|近景|深景)(?:处的)?(大海|海面|细沙|沙地|沙滩|陆地|门外)/g),
          ...positionText.matchAll(/(大海|海面|细沙|沙地|沙滩|陆地|门外)(?:处于|作为)?(远景|近景|深景)/g),
        ];
        for (const m of anchorMatches) {
          const depth = m[1].includes('景') ? m[1] : m[2];
          const anchor = m[1].includes('景') ? m[2] : m[1];
          const normAnchor = (anchor === '海面') ? '大海' : ((anchor === '沙地' || anchor === '沙滩') ? '细沙' : anchor);
          const normDepth = (depth === '深景' || depth === '远景') ? '远景' : depth;
          if (!segmentAnchorDepths.has(normAnchor)) {
            segmentAnchorDepths.set(normAnchor, normDepth);
          } else if (segmentAnchorDepths.get(normAnchor) !== normDepth) {
            fail(`${context} shot ${index + 1} violates Rule 0.17: spatial anchor depth drift detected! Anchor "${normAnchor}" was established as "${segmentAnchorDepths.get(normAnchor)}", but switched to "${normDepth}". In a single segment, anchor depth is invariant.`);
          }
        }
      }

      // Rule 0.18 Check: Dialogue Lip-Sync & Strict OS Voiceover Isolation Gate
      const dialogueText = fields.get('台词/O.S./OS') || '';
      const hasSpokenDialogue = dialogueText !== '无' && dialogueText !== '无。' && !/^(?:无[。；]?)$/.test(dialogueText.trim());

      if (hasSpokenDialogue && hasCharacterInShot) {
        const hasLipMovement = /(?:开口|张嘴|张口|嘴唇.*张合|说话|咬字|发声|念出)/i.test(actionText);
        const hasClosedLips = /(?:双唇.*闭合|严禁口型|闭口|不张嘴)/i.test(dialogueText + ' ' + actionText);
        const dialogueNotes = dialogueText.replace(/[“"][^”"\n]*[”"]/g, '');
        const mentionsVoiceover = /(?:画外音|O\.S\.|OS)/i.test(dialogueNotes);
        const isInnerMonologue = /(?:内心(?:声音|独白)|（(?:OS|O\.S\.)）)/i.test(dialogueNotes);

        if (isInnerMonologue) {
          if (!hasClosedLips) {
            fail(`${context} shot ${index + 1} violates Rule 0.18: character on-screen during OS/inner monologue must declare closed lips ("双唇严密闭合，严禁口型驱动")!`);
          }
        } else {
          const isExplicitOnScreen = /(?:开口|张嘴|现场原声|自然咬合|人嘴)/i.test(dialogueNotes);
          if (isExplicitOnScreen && mentionsVoiceover) {
            fail(`${context} shot ${index + 1} violates Rule 0.18: on-screen spoken dialogue contains forbidden OS/voiceover label pollution ("画外音", "O.S."). Must declare as on-screen speech.`);
          }
          if (isExplicitOnScreen && !hasLipMovement) {
            fail(`${context} shot ${index + 1} violates Rule 0.18: on-screen spoken dialogue without OS requires explicit physical mouth/lip action in 动作/表演 ("嘴唇自然张合开口说话", "面部配合咬字发声")!`);
          }
        }
      }

      // Rule 0.21 Check: Zero Wardrobe Declaration in Continuity Gate
      if (positionText) {
        const forbiddenWardrobeRegex = /(?:身穿|穿着|穿戴|着装|佩戴|套着|工装|便服|长裤|短裤|短袖|长袖|衬衫|西装|T恤|旗袍|马甲|外衣|夹克)/;
        const match = positionText.match(forbiddenWardrobeRegex);
        if (match) {
          fail(`${context} shot ${index + 1} violates Rule 0.21: 【位置承接】 contains forbidden wardrobe declaration ("${match[0]}"). Wardrobe must be 100% defined by character reference image assets.`);
        }
      }

      // Rule 0.20 Check: POV Underwater Angle & Zero Sky-Fish Gate
      const hasSkyOrHorizon = /(?:天空|苍穹|地平线|开阔海面|远景海面|晴空|海风)/.test(actionText + ' ' + sceneText);
      const hasUnderwaterFish = /(?:水下.*?(?:游鱼|鱼群|游弋|海鱼|石斑|黄鱼)|海里.*?(?:游鱼|鱼群|游弋|海鱼)|水中.*?(?:游鱼|鱼群|游弋|海鱼)|海底.*?(?:游鱼|鱼群|游弋|海鱼))/.test(actionText);
      const isHighAnglePOV = /(?:大俯角.*?(?:俯视水面|俯视清澈海水)|垂直向下.*?(?:俯视|俯拍)|主观视点.*?(?:俯视水面|水下)|POV)/.test(framingText + ' ' + actionText);
      if (hasSkyOrHorizon && hasUnderwaterFish && !isHighAnglePOV) {
        fail(`${context} shot ${index + 1} violates Rule 0.20: objective shot with sky/horizon contains underwater fish ("fish flying in sky" hazard). Must decouple into objective setup shot and pure high-angle top-down underwater POV shot.`);
      }

      // Rule 0.22 Check: Zero Vague Relative Position & Lateral Screen Invariance Gate
      if (positionText) {
        const matchVaguePos = positionText.match(/(?:身侧|旁侧|身旁|旁边|在旁)/);
        if (matchVaguePos) {
          fail(`${context} shot ${index + 1} violates Rule 0.22: 【位置承接】 contains forbidden vague relative position word ("${matchVaguePos[0]}"). Must specify explicit screen coordinates ("画左", "画右", "主体X左侧/右侧半步") and synchronize with anchor depth.`);
        }
      }
      if (actionText) {
        const matchVagueAction = actionText.match(/(?:身侧|旁侧|身旁|旁边|在旁)/);
        if (matchVagueAction) {
          fail(`${context} shot ${index + 1} violates Rule 0.22: 【动作/表演】 contains forbidden vague relative position word ("${matchVagueAction[0]}"). Must specify explicit screen coordinates ("画左", "画右").`);
        }
      }

      // Rule 0.24 Check: Mandatory Storyboard Keyframe Image & Spatial Lineart Decoupling Gate
      if (hasCharacterInShot && positionText.includes('[线稿图对应关系：')) {
        const lineartContent = positionText.match(/\[线稿图对应关系：([^\]]+)\]/)?.[1] || '';
        if (!lineartContent.includes('主体')) {
          fail(`${context} shot ${index + 1} violates Rule 0.24: lineart mapping [线稿图对应关系：...] must explicitly map lineart figures to subjects (e.g. "对应主体1").`);
        }
      }

      previousActionText = actionText;
    }
    if ((field.match(/主体锁：/g) || []).length !== 1 || !field.includes('各主体仅保留自身主体锁，不交换外观。')) {
      fail(`${context} timed range ${index + 1} must contain exactly one complete subject lock.`);
    }
  }

  validateSubjects(prompt, assets, context);
  const aliases = getCharacterAliasEntries(config, assets);
  assets.forEach((asset, index) => {
    const expected = `{{Mixed ${index + 1}}}`;
    if (asset.mixedToken !== expected) fail(`${context} expected ${expected}, found ${asset.mixedToken}.`);
    if (!prompt.includes(expected)) fail(`${context} prompt does not reference ${expected}.`);
  });
  for (const match of prompt.matchAll(/\{\{Mixed\s+(\d+)\}\}/g)) {
    const number = Number(match[1]);
    if (number < 1 || number > assets.length) fail(`${context} references undefined {{Mixed ${number}}}.`);
  }
  const roleListEnd = prompt.indexOf('【资源引用】') !== -1
    ? prompt.indexOf('【资源引用】')
    : (prompt.indexOf('【场景】') !== -1 ? prompt.indexOf('【场景】') : prompt.indexOf('【站位与起始状态】'));
  const roleList = prompt.slice(prompt.indexOf('【角色清单】'), roleListEnd);
  for (const asset of assets.filter((item) => ['character', 'location', 'prop'].includes(item.assetType))) {
    const number = asset.mixedToken.match(/\d+/)?.[0];
    const token = escapeRegExp(asset.mixedToken);
    if (!new RegExp(`把 ${token} 中[\\s\\S]*?作为主体${number}`).test(roleList)) {
      fail(`${context} does not define ${asset.mixedToken} as 主体${number}.`);
    }
  }
  assertNamesOnlyInAllowedSpans(prompt, roleListEnd, aliases, context);
  const definitions = [...roleList.matchAll(/把\s+(\{\{Mixed\s+(\d+)\}\})\s+中[^；\n]+作为主体(\d+)[；。]/g)];
  const visualAssets = assets.filter((item) => ['character', 'location', 'prop'].includes(item.assetType));
  if (definitions.length !== visualAssets.length) {
    fail(`${context} role list must contain exactly one bounded definition per visual asset.`);
  }
  for (const definition of definitions) {
    if (definition[2] !== definition[3]) fail(`${context} maps ${definition[1]} to the wrong subject number.`);
  }
  const audioAssets = assets.filter((item) => item.assetType === 'audio');
  for (const asset of audioAssets) {
    const token = escapeRegExp(asset.mixedToken);
    if (!new RegExp(`${token}\\s+(?:为|作为|提供|限定)[^\\n；。]+音频参考`).test(prompt)) {
      fail(`${context} does not define audio asset ${asset.mixedToken} as audio reference.`);
    }
  }
  if (/CHAR\d{3}|角色锁|各角色|主体\d+-主体\d+/.test(prompt)) {
    fail(`${context} contains a legacy subject alias.`);
  }
  const quotedSubjectMatch = prompt.match(/[“"][^”"\n]*?主体\d+[^”"\n]*?[”"]/);
  if (quotedSubjectMatch) {
    fail(`${context} violates Rule 0.12: quoted literal dialogue/speech contains forbidden subject placeholder token (${quotedSubjectMatch[0]}). Dialogue/O.S. lines must remain 100% verbatim from original script and must never substitute words with 主体N.`);
  }
  if (/\bC\d{3}\b|\bSHOT\d{3,}\b|秒｜镜头\d+|\bclipId\b/i.test(prompt)) {
    fail(`${context} contains an internal planning identifier.`);
  }
  if (/\{\{TailFrame\}\}|tail[-_ ]frame/i.test(prompt)) {
    fail(`${context} contains a deprecated video tail-frame input.`);
  }
  const endingPolicy = profile.prompt.endingPolicy;
  if ((prompt.match(new RegExp(escapeRegExp(endingPolicy), 'g')) || []).length !== 1) {
    fail(`${context} must contain exactly one no-tail-frame/no-background-music sentence.`);
  }
  if (!numberedFormat && profile.prompt.stateChangeContract === 'explicit_pre_action_ordered_action_post_action') {
    for (const marker of ['动作前状态：', '动作顺序：', '动作后状态：']) {
      if (!prompt.includes(marker)) fail(`${context} is missing ${marker}`);
    }
  }
  const visualStyleSuffix = profile.look.styleSuffix;
  if (visualStyleSuffix && !prompt.endsWith(visualStyleSuffix)) {
    fail(`${context} does not end with the configured visual-style suffix.`);
  }
  if (visualStyleSuffix && !prompt.endsWith(`${endingPolicy}\n\n${visualStyleSuffix}`)) {
    fail(`${context} must place the no-tail-frame/no-background-music sentence immediately before the style suffix.`);
  }
  if (numberedFormat) {
    const states = physicalStates(prompt, timed, profile);
    return { inheritedSnapshot: segment.sameSceneAsPrevious ? states.startKey : '', endingSnapshot: states.endKey, timedRanges: timed.length };
  }
  const endingSnapshot = prompt.match(/^连续性快照：([^\r\n]+)/m)?.[1] || '';
  if (!endingSnapshot) fail(`${context} is missing a complete written ending snapshot.`);
  return {
    inheritedSnapshot: prompt.match(/^继承连续性快照：([^\r\n]+)/m)?.[1] || '',
    endingSnapshot,
    timedRanges: timed.length,
  };
}

function main() {
const options = parseArgs(process.argv.slice(2));
const config = JSON.parse(readText(options.config, 'episode package config'));
const profile = resolveProductionProfile(config);
validateDuration(config);
if (!Array.isArray(config.segments) || config.segments.length === 0) fail('Config has no segments.');

const results = [];
for (const segment of config.segments) {
  const promptPath = path.resolve(options.projectRoot, segment.promptSource);
  const prompt = readText(promptPath, `${segment.id} prompt`);
  const result = validatePrompt(config, profile, segment, prompt);
  if (segment.sameSceneAsPrevious === true && !result.inheritedSnapshot) {
    fail(`${segment.id} is marked sameSceneAsPrevious but has no inherited continuity payload.`);
  }
  if (segment.sameSceneAsPrevious === false && result.inheritedSnapshot) {
    fail(`${segment.id} inherits continuity while sameSceneAsPrevious is false.`);
  }
  if (result.inheritedSnapshot) {
    const previous = results.at(-1);
     if (!previous || !previous.endingSnapshot || previous.endingSnapshot !== result.inheritedSnapshot) {
      fail(`${segment.id} inherited continuity payload does not equal the previous configured prompt ending payload.`);
    }
  }
  results.push({ id: segment.id, promptPath, ...result });
}

console.log(JSON.stringify({
  projectRoot: options.projectRoot,
  config: options.config,
  productionProfile: profile.profileId,
  prompts: results.length,
  timedRanges: results.reduce((sum, item) => sum + item.timedRanges, 0),
  inheritedContinuityChecks: results.filter((item) => item.inheritedSnapshot).length,
  internalPlanningIdentifiers: 0,
  validation: 'passed',
}));
}

if (require.main === module) main();
module.exports = { validatePrompt };

const LEGACY_SCHEMA_VERSION = 'auto-episode-package/2.1';
const PREVIOUS_SCHEMA_VERSION = 'auto-episode-package/2.2';
const CURRENT_SCHEMA_VERSION = 'auto-episode-package/2.3';
const NO_TAIL_FRAME_POLICY = '仅记录文字状态，不上传或引用视频尾帧。';
const LEGACY_ENDING_POLICY = `${NO_TAIL_FRAME_POLICY}全程无背景音乐。`;

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} must be a non-empty string.`);
  const resolved = value.trim();
  if (/REQUIRED(?:_|$)|project[-_ ](?:defined|slug)/i.test(resolved)) {
    throw new Error(`${field} still contains a template placeholder.`);
  }
  return resolved;
}

function requireInteger(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function resolveProductionProfile(config) {
  if (config.schemaVersion === LEGACY_SCHEMA_VERSION) {
    return {
      schemaVersion: 'auto-production-profile/legacy-2.1',
      profileId: 'legacy-2.1',
      contentCategory: 'scripted_narrative',
      genres: ['project_defined'],
      visualMedium: 'project_defined',
      audience: 'project_defined',
      tone: ['project_defined'],
      look: { styleSuffix: config.visualStyleSuffix || '' },
      prompt: {
        language: 'zh-CN',
        timedPhaseMinimum: 4,
        timedPhaseMaximum: 6,
        stateChangeContract: config.stateChangeContract || 'explicit_pre_action_ordered_action_post_action',
        continuityMode: 'written_ending_state_only',
        musicPolicy: 'none',
        endingPolicy: LEGACY_ENDING_POLICY,
      },
    };
  }
  if (![PREVIOUS_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION].includes(config.schemaVersion)) {
    throw new Error(`Config schemaVersion must be ${LEGACY_SCHEMA_VERSION}, ${PREVIOUS_SCHEMA_VERSION} or ${CURRENT_SCHEMA_VERSION}.`);
  }

  const profile = config.productionProfile;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error('Auto episode package 2.2+ requires productionProfile.');
  }
  if (profile.schemaVersion !== 'auto-production-profile/1.0') {
    throw new Error('productionProfile.schemaVersion must be auto-production-profile/1.0.');
  }
  const genres = Array.isArray(profile.genres) ? profile.genres.map((item) => requireText(item, 'productionProfile.genres entry')) : [];
  const tone = Array.isArray(profile.tone) ? profile.tone.map((item) => requireText(item, 'productionProfile.tone entry')) : [];
  if (genres.length === 0) throw new Error('productionProfile.genres must contain at least one project genre or documentary form.');
  if (tone.length === 0) throw new Error('productionProfile.tone must contain at least one project tone.');
  const look = profile.look;
  const prompt = profile.prompt;
  if (!look || typeof look !== 'object') throw new Error('productionProfile.look is required.');
  if (!prompt || typeof prompt !== 'object') throw new Error('productionProfile.prompt is required.');

  const resolved = {
    schemaVersion: profile.schemaVersion,
    profileId: requireText(profile.profileId, 'productionProfile.profileId'),
    contentCategory: requireText(profile.contentCategory, 'productionProfile.contentCategory'),
    genres,
    visualMedium: requireText(profile.visualMedium, 'productionProfile.visualMedium'),
    audience: requireText(profile.audience, 'productionProfile.audience'),
    tone,
    look: {
      styleSuffix: requireText(look.styleSuffix, 'productionProfile.look.styleSuffix'),
    },
    prompt: {
      language: requireText(prompt.language, 'productionProfile.prompt.language'),
      shotFormat: prompt.shotFormat || 'timed_legacy',
      requireShotDuration: prompt.requireShotDuration ?? false,
      timedPhaseMinimum: requireInteger(prompt.timedPhaseMinimum, 'productionProfile.prompt.timedPhaseMinimum', 1, 12),
      timedPhaseMaximum: requireInteger(prompt.timedPhaseMaximum, 'productionProfile.prompt.timedPhaseMaximum', 1, 12),
      stateChangeContract: requireText(prompt.stateChangeContract, 'productionProfile.prompt.stateChangeContract'),
      continuityMode: requireText(prompt.continuityMode, 'productionProfile.prompt.continuityMode'),
      musicPolicy: requireText(prompt.musicPolicy, 'productionProfile.prompt.musicPolicy'),
      endingPolicy: requireText(prompt.endingPolicy, 'productionProfile.prompt.endingPolicy'),
    },
  };
  if (resolved.prompt.language !== 'zh-CN') throw new Error('The current TSC compiler requires productionProfile.prompt.language zh-CN.');
  if (!['timed_legacy', 'numbered_fields_v1'].includes(resolved.prompt.shotFormat)) throw new Error('Unknown productionProfile.prompt.shotFormat.');
  if (typeof resolved.prompt.requireShotDuration !== 'boolean' || (resolved.prompt.requireShotDuration && resolved.prompt.shotFormat !== 'numbered_fields_v1')) throw new Error('requireShotDuration must be boolean and requires numbered_fields_v1.');
  if (resolved.prompt.timedPhaseMaximum < resolved.prompt.timedPhaseMinimum) {
    throw new Error('productionProfile prompt timed-phase maximum must be greater than or equal to its minimum.');
  }
  if (resolved.prompt.continuityMode !== 'written_ending_state_only') {
    throw new Error('The current Auto continuity contract requires written_ending_state_only.');
  }
  if (!resolved.prompt.endingPolicy.includes(NO_TAIL_FRAME_POLICY)) {
    throw new Error(`productionProfile.prompt.endingPolicy must include: ${NO_TAIL_FRAME_POLICY}`);
  }
  if (resolved.prompt.musicPolicy === 'none' && !resolved.prompt.endingPolicy.includes('全程无背景音乐。')) {
    throw new Error('A none musicPolicy requires the ending policy to state 全程无背景音乐。');
  }
  return resolved;
}

module.exports = {
  CURRENT_SCHEMA_VERSION,
  LEGACY_ENDING_POLICY,
  LEGACY_SCHEMA_VERSION,
  NO_TAIL_FRAME_POLICY,
  PREVIOUS_SCHEMA_VERSION,
  resolveProductionProfile,
};

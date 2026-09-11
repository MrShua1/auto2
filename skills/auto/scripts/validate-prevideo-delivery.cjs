#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const { spawnSync } = require('child_process');
const { resolveProductionProfile } = require('./lib/production-profile.cjs');
const { validateContentReview, REVIEW_FILE } = require('./lib/content-review.cjs');
const { validateMapping } = require('./lib/package-mapping.cjs');

let YAML;
try {
  YAML = require('yaml');
} catch {
  throw new Error('The OpenCode YAML runtime is unavailable; /分集 is BLOCKED before pre-video validation.');
}

function fail(message) {
  throw new Error(message);
}

function validateWorkbookFile(root, workbook, result, kind) {
  const checked = spawnSync(process.execPath, [path.join(__dirname, 'workbook-openxml.cjs'), 'validate', root, workbook, result, kind], { encoding: 'utf8', windowsHide: true });
  if (checked.status !== 0) fail(`Workbook reopen/hash validation failed: ${checked.stderr || checked.stdout}`);
}

function parseArgs(argv) {
  const options = {
    projectRoot: process.cwd(),
    config: 'episode-package-config.json',
    state: 'auto-state.json',
    finalize: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage:
  node validate-prevideo-delivery.cjs [--project-root <path>] [--config <path>] [--state <path>] [--finalize]

Validates a complete /分集 pre-video package. --finalize updates source and packaged auto-state.json only after all gates pass.`);
      process.exit(0);
    }
    if (arg === '--finalize') {
      options.finalize = true;
      continue;
    }
    if (!['--project-root', '--config', '--state'].includes(arg)) fail(`Unknown argument: ${arg}`);
    const value = argv[++index];
    if (!value || value.startsWith('--')) fail(`${arg} requires a value.`);
    const key = arg === '--project-root' ? 'projectRoot' : arg.slice(2);
    options[key] = value;
  }
  options.projectRoot = path.resolve(options.projectRoot);
  for (const key of ['config', 'state']) {
    options[key] = path.isAbsolute(options[key]) ? options[key] : path.resolve(options.projectRoot, options[key]);
  }
  return options;
}

function readText(filePath, label) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) fail(`Missing ${label}: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}

function readJson(filePath, label) {
  try {
    return JSON.parse(readText(filePath, label));
  } catch (error) {
    fail(`Invalid ${label}: ${error.message}`);
  }
}

function readYaml(filePath, label) {
  try {
    return YAML.parse(readText(filePath, label));
  } catch (error) {
    fail(`Invalid ${label}: ${error.message}`);
  }
}

function resolveFrom(root, value, label) {
  if (!value || typeof value !== 'string') fail(`${label} path is required.`);
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(root, value);
}

function normalizedText(filePath, label) {
  return readText(filePath, label);
}

function assertSameText(source, packaged, label) {
  if (normalizedText(source, `${label} source`) !== normalizedText(packaged, `${label} package`)) {
    fail(`${label} differs between the working project and formal delivery.`);
  }
}

function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function normalizedPathSet(paths) {
  return new Set(paths.map((item) => path.normalize(item).toLowerCase()));
}

function assertSameSet(actual, expected, label) {
  if (actual.size !== expected.size || [...actual].some((item) => !expected.has(item))) {
    fail(`${label} does not match the approved image manifest.`);
  }
}

function validateAssetRequirements(registry, state, root) {
  const materialFile = path.join(root, 'material-integration.json');
  if (!fs.existsSync(materialFile)) fail('Auto D requires material-integration.json; record applicable:false with a reason only when no supplied materials exist.');
  const materials = require('./validate-material-integration.cjs').validate(root, JSON.parse(fs.readFileSync(materialFile, 'utf8')));
  if (!materials.passed) fail(`Material-in-frame gate failed: ${materials.errors.join('; ')}`);
  if (registry.schemaVersion !== 'auto-asset-requirements/1.0' || registry.projectId !== state.project?.id) {
    fail('Asset requirement registry schema or project ID does not match Auto state.');
  }
  if (path.resolve(registry.projectRoot || '') !== path.resolve(root)) fail('Asset requirement registry PROJECT_ROOT mismatch.');
  const scriptPath = resolveFrom(root, registry.scriptSource, 'Asset requirement script source');
  if (fileHash(scriptPath).toLowerCase() !== String(registry.scriptSha256 || '').toLowerCase()) {
    fail('Asset requirement registry script hash no longer matches the authoritative script.');
  }
  if (!Array.isArray(registry.rows)) fail('Asset requirement registry rows must be an array.');
  const versionIds = new Set();
  const episodeCounts = new Map();
  const finalPaths = new Set();
  let validExisting = 0;
  let validGenerated = 0;
  for (const row of registry.rows) {
    if (!row.versionId || versionIds.has(row.versionId)) fail(`Duplicate or missing asset requirement versionId: ${row.versionId || 'EMPTY'}`);
    versionIds.add(row.versionId);
    if (!['character', 'location', 'prop'].includes(row.assetType) || !row.entityId || !row.name || !row.semanticClass) {
      fail(`Asset requirement row is incomplete: ${row.versionId}`);
    }
    if (!Array.isArray(row.episodes) || row.episodes.length === 0 || !Array.isArray(row.scenes) || row.scenes.length === 0 || !Array.isArray(row.scriptEvidence) || row.scriptEvidence.length === 0) {
      fail(`Asset requirement row lacks episode, scene or script evidence: ${row.versionId}`);
    }
    if (!['approved_existing', 'approved_generated'].includes(row.validationStatus) || !Array.isArray(row.confirmationEvidence) || row.confirmationEvidence.length === 0) {
      fail(`Asset requirement is not explicitly approved by the human reviewer: ${row.versionId}`);
    }
    if (!row.finalPath || !row.finalSha256) fail(`Resolved asset requirement lacks final path or hash: ${row.versionId}`);
    const finalPath = resolveFrom(root, row.finalPath, `${row.versionId} final asset`);
    if (!fs.existsSync(finalPath) || fileHash(finalPath).toLowerCase() !== String(row.finalSha256).toLowerCase()) {
      fail(`Resolved asset requirement final file is missing or changed: ${row.versionId}`);
    }
    finalPaths.add(path.normalize(finalPath).toLowerCase());
    if (row.validationStatus === 'approved_existing') validExisting += 1;
    else validGenerated += 1;
    for (const episode of row.episodes) {
      const current = episodeCounts.get(episode) || { required: 0, valid: 0 };
      current.required += 1;
      current.valid += 1;
      episodeCounts.set(episode, current);
    }
  }
  if (registry.status !== 'COMPLETE' || Number(registry.coverage?.missingVersions) !== 0 || Number(registry.coverage?.invalidVersions) !== 0) {
    fail('Asset requirement registry must be COMPLETE with zero missing, invalid or pending-human-review versions.');
  }
  if (Number(registry.coverage?.pendingHumanReviewVersions) !== 0) fail('Asset requirement registry still has versions pending human review.');
  if (Number(registry.coverage?.fullSeriesRequiredVersions) !== registry.rows.length || Number(registry.coverage?.validExistingVersions) !== validExisting || Number(registry.coverage?.validGeneratedVersions) !== validGenerated) {
    fail('Asset requirement full-series coverage counters do not match its rows.');
  }
  const reportedEpisodes = new Map((registry.coverage?.byEpisode || []).map((item) => [item.episodeId, item]));
  for (const [episodeId, count] of episodeCounts) {
    const reported = reportedEpisodes.get(episodeId);
    if (!reported || Number(reported.requiredVersions) !== count.required || Number(reported.validVersions) !== count.valid || Number(reported.missingVersions) !== 0 || Number(reported.invalidVersions) !== 0 || Number(reported.pendingHumanReviewVersions) !== 0) {
      fail(`Asset requirement episode coverage mismatch: ${episodeId}`);
    }
  }
  if (reportedEpisodes.size !== episodeCounts.size) fail('Asset requirement registry reports unexpected episode coverage rows.');
  if (registry.review?.scriptRequirementCoverage !== 'passed' || registry.review?.humanApproval !== 'approved' || !registry.review?.reviewedAt) {
    fail('Asset requirement registry lacks completed script-requirement coverage and human approval.');
  }
  return { required: registry.rows.length, validExisting, validGenerated, episodes: episodeCounts.size, finalPaths };
}

function listNames(directory, label) {
  if (!fs.existsSync(directory) || !fs.statSync(directory).isDirectory()) fail(`Missing ${label}: ${directory}`);
  return fs.readdirSync(directory).sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

function sameNames(actual, expected) {
  const sortedExpected = [...expected].sort((left, right) => left.localeCompare(right, 'zh-CN'));
  return actual.length === sortedExpected.length && actual.every((item, index) => item === sortedExpected[index]);
}

function approvedManifestPaths(manifest, root, requiresApprovedImages) {
  if (manifest.status !== 'approved_complete' || manifest.humanReview?.status !== 'approved') {
    fail('Image delivery manifest is not explicitly approved_complete by human review.');
  }
  if (!manifest.humanReview.reviewedAt) fail('Image delivery manifest lacks its aggregate human review timestamp.');
  if ((manifest.missingRequiredItems || []).length !== 0 || (manifest.failedOriginals || []).some((item) => item.required !== false && item.status !== 'repaired')) {
    fail('Image delivery manifest still contains missing or unrepaired required image tasks.');
  }
  const approved = new Set();
  for (const item of manifest.items || []) {
    if (item.approvalStatus !== 'approved') continue;
    if (!item.assetId || !item.role || !item.sha256 || item.approvedAt !== manifest.humanReview.reviewedAt) {
      fail('Every approved image manifest item requires assetId, role, sha256 and the aggregate approval timestamp.');
    }
    const itemPath = resolveFrom(root, item.path, `Image manifest item ${item.assetId || item.role}`);
    if (!fs.existsSync(itemPath) || !fs.statSync(itemPath).isFile()) fail(`Approved image is missing: ${itemPath}`);
    const actualHash = fileHash(itemPath);
    if (actualHash.toLowerCase() !== String(item.sha256).toLowerCase()) fail(`Approved image hash mismatch: ${itemPath}`);
    approved.add(path.normalize(itemPath).toLowerCase());
  }
  if (requiresApprovedImages && approved.size === 0) fail('Image delivery manifest has no human-approved existing image files for configured visual-reference slots.');
  return approved;
}

function validateSoundManifest(manifest, root) {
  if (manifest.schema_version !== 'auto-sound-references/2.1' || manifest.complete !== true || (manifest.missing_required_references || []).length !== 0) {
    fail('Sound reference manifest has unresolved required references.');
  }
  const entries = [
    ...(manifest.character_voice_references || []),
    ...(manifest.story_critical_sound_references || []),
  ];
  const approved = new Set();
  for (const entry of entries) {
    if (entry.required === false) continue;
    if (entry.availability !== 'available' || entry.approval_status !== 'approved') {
      fail(`Required sound reference is not available and approved: ${entry.speaker || entry.sound || entry.path}`);
    }
    const entryPath = resolveFrom(root, entry.path, 'Sound reference');
    if (!fs.existsSync(entryPath) || !fs.statSync(entryPath).isFile()) fail(`Approved sound reference is missing: ${entryPath}`);
    approved.add(path.normalize(entryPath).toLowerCase());
  }
  return approved;
}

function validateHandoff(handoff, segment, assetCount, productionProfile, requireProductionProfile, videoBackend) {
  if (handoff.schema_version !== 'auto-tsc-handoff/2.1') fail(`${segment.id} handoff must use auto-tsc-handoff/2.1.`);
  if (handoff.segment_id !== segment.id) fail(`${segment.id} handoff segment ID mismatch.`);
  if (Number(handoff.duration?.proposed_seconds) !== Number(segment.durationSeconds)) fail(`${segment.id} handoff duration mismatch.`);
  if (videoBackend === 'libtv' && (handoff.model?.capability_status !== 'verified' || !handoff.model?.capability_source)) {
    fail(`${segment.id} LibTV handoff lacks a verified model capability source.`);
  }
  if (videoBackend !== 'libtv' && (handoff.model?.backend !== videoBackend || !['unbound', 'declared', 'verified'].includes(handoff.model?.capability_status))) {
    fail(`${segment.id} handoff does not record the ${videoBackend} backend state.`);
  }
  if (handoff.script?.coverage_status !== 'REQUIRED_100_PERCENT' && handoff.script?.coverage_status !== 'exact_segment_passage') {
    fail(`${segment.id} handoff does not record complete source coverage.`);
  }
  if (handoff.continuity?.continuity_mode !== 'written_ending_state_only') fail(`${segment.id} handoff continuity mode is invalid.`);
  if (requireProductionProfile && (handoff.production_profile?.profile_id !== productionProfile.profileId || handoff.production_profile?.status !== 'locked')) {
    fail(`${segment.id} handoff is not locked to production profile ${productionProfile.profileId}.`);
  }
  const references = handoff.references || [];
  if (!Array.isArray(references) || references.length !== assetCount) fail(`${segment.id} handoff reference count mismatch.`);
  references.forEach((reference, index) => {
    const token = `{{Mixed ${index + 1}}}`;
    if (reference.mixed_token !== token) fail(`${segment.id} handoff expected ${token}.`);
    if (reference.required !== true || reference.availability !== 'available' || reference.approval_status !== 'approved') {
      fail(`${segment.id} ${token} is not required, available and approved.`);
    }
    if (reference.slot_status !== 'package_slot_verified') fail(`${segment.id} ${token} package slot is not verified.`);
  });
  if (handoff.status !== 'complete_local_prompt_video_generation_not_executed') {
    fail(`${segment.id} handoff is not a complete pre-video prompt handoff.`);
  }
}

function parseMapping(filePath, assets, segmentId) {
  validateMapping(readText(filePath, `${segmentId} asset mapping`), assets, segmentId);
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(absolute));
    else files.push(absolute);
  }
  return files;
}

function writeJsonFilesAtomic(filePaths, value) {
  const transaction = `${process.pid}.${Date.now()}`;
  const records = filePaths.map((filePath, index) => ({
    filePath,
    temporary: `${filePath}.${transaction}.${index}.tmp`,
    backup: `${filePath}.${transaction}.${index}.bak`,
    backedUp: false,
    committed: false,
  }));
  try {
    for (const record of records) fs.writeFileSync(record.temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    for (const record of records) {
      if (fs.existsSync(record.filePath)) {
        fs.renameSync(record.filePath, record.backup);
        record.backedUp = true;
      }
      fs.renameSync(record.temporary, record.filePath);
      record.committed = true;
    }
    for (const record of records) if (record.backedUp) fs.rmSync(record.backup, { force: true });
  } catch (error) {
    for (const record of [...records].reverse()) {
      if (record.committed && fs.existsSync(record.filePath)) fs.rmSync(record.filePath, { force: true });
      if (record.backedUp && fs.existsSync(record.backup)) fs.renameSync(record.backup, record.filePath);
      if (fs.existsSync(record.temporary)) fs.rmSync(record.temporary, { force: true });
    }
    throw error;
  }
}

const options = parseArgs(process.argv.slice(2));
const config = readJson(options.config, 'episode package config');
const state = readJson(options.state, 'Auto state');
const videoBackend = config.videoBackend || 'libtv';
if (!['unselected', 'libtv', 'custom'].includes(videoBackend)) fail('videoBackend must be unselected, libtv or custom.');

if (!['auto-episode-package/2.1', 'auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion) || config.packageMode !== 'final_prevideo') {
  fail('Final /分集 validation requires a supported Auto episode package with packageMode final_prevideo.');
}
if (config.schemaVersion === 'auto-episode-package/2.3' && !/^第[1-9]\d*集$/u.test(config.episodeFolder || '')) {
  fail('Auto 2.3 final pre-video episodeFolder must be named 第1集, 第2集, and so on.');
}
const productionProfile = resolveProductionProfile(config);
if (!['auto-state/2.0', 'auto-state/2.1', 'auto-state/2.2'].includes(state.schemaVersion)) fail('Auto state must use auto-state/2.0, 2.1 or 2.2.');
if (['auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion)) {
  const requiredStateSchema = config.schemaVersion === 'auto-episode-package/2.3' ? 'auto-state/2.2' : 'auto-state/2.1';
  if (state.schemaVersion !== requiredStateSchema) fail(`${config.schemaVersion} requires ${requiredStateSchema}.`);
  const { status: profileStatus, ...stateProfile } = state.productionProfile || {};
  if (profileStatus !== 'locked' || !isDeepStrictEqual(stateProfile, config.productionProfile)) {
    fail('Auto state production profile is not locked to the package production profile.');
  }
  if (config.schemaVersion === 'auto-episode-package/2.3' && (state.projectIntake?.projectRootProvided !== true || state.projectIntake?.initialConfirmedAssetCheck !== 'complete' || state.projectIntake?.scriptPreviewStatus !== 'complete' || state.projectIntake?.inventoryStatus !== 'complete' || state.projectIntake?.allScriptCandidatesRead !== true || state.projectIntake?.allImageCandidatesListed !== true)) {
    fail('PROJECT_ROOT intake, script preview, recursive inventory or candidate listing is incomplete.');
  }
  if (config.schemaVersion === 'auto-episode-package/2.3' && (state.imageDelivery?.generationExistenceCheck !== 'passed' || state.imageDelivery?.allGeneratedOutputsDeliveredForHumanReview !== true || state.imageDelivery?.automaticImageReviewPerformed !== false)) {
    fail('Image delivery must pass generation-existence checks, be delivered for human review and record that no automatic image review occurred.');
  }
}
if (state.control?.mode !== 'episode_prevideo' || state.control?.terminalStage !== 'pre_video_delivery_complete') {
  fail('Auto state is not locked to /分集 episode_prevideo mode.');
}
if (state.control?.videoSideEffectsAllowed !== false || state.budget?.hardStopPolicy !== 'no_video_side_effects') {
  fail('/分集 no-video hard stop is not active.');
}
if (Number(state.budget?.videoLimit) !== 0 || Number(state.budget?.videoUsed) !== 0 || state.video?.inScope !== false || Number(state.video?.generated) !== 0) {
  fail('/分集 state reports video scope or usage.');
}
if (!['ready_for_validation', 'complete'].includes(state.preVideoDelivery?.status)) {
  fail('preVideoDelivery.status must be ready_for_validation before final validation.');
}
if (state.aggregateAssetReview?.status !== 'approved' || !state.aggregateAssetReview?.reviewedAt) {
  fail('Aggregate human asset review is not approved.');
}
const identityWardrobeReviewField = config.schemaVersion === 'auto-episode-package/2.3' ? 'promptIdentityWardrobeContracts' : 'identityWardrobe';
for (const field of ['scriptCoverage', 'dialogueFidelity', 'continuity', identityWardrobeReviewField, 'spatialTopology', 'stateChanges', 'promptAliases']) {
  if (state.semanticReview?.[field] !== 'passed') fail(`Semantic review is incomplete: ${field}.`);
}
if (state.semanticReview?.status !== 'passed' || !state.semanticReview?.reviewedAt) fail('Semantic review is not complete.');
if (videoBackend === 'libtv' && (state.modelContract?.status !== 'verified' || !state.modelContract?.capabilitySource)) {
  fail('LibTV model capability contract is not verified.');
}
if (videoBackend !== 'libtv' && (state.modelContract?.backend !== videoBackend || !['unbound', 'declared', 'verified'].includes(state.modelContract?.status))) {
  fail(`Model contract does not record the ${videoBackend} backend state.`);
}

const promptValidator = path.join(__dirname, 'validate-video-prompts.cjs');
const promptResult = spawnSync(process.execPath, [promptValidator, '--project-root', options.projectRoot, '--config', options.config], {
  encoding: 'utf8',
  windowsHide: true,
});
if (promptResult.status !== 0) fail(`Prompt-set validation failed:\n${[promptResult.stdout, promptResult.stderr].filter(Boolean).join('\n').trim()}`);

const imageManifestPath = resolveFrom(options.projectRoot, state.preVideoDelivery.imageManifestPath, 'Image manifest');
const imageManifest = readJson(imageManifestPath, 'image delivery manifest');
if (imageManifest.schemaVersion !== 'auto-image-delivery-manifest/2.1' || imageManifest.projectId !== state.project?.id) {
  fail('Image delivery manifest schema or project ID does not match Auto state.');
}
if (imageManifest.humanReview?.reviewedAt !== state.aggregateAssetReview.reviewedAt) {
  fail('Image manifest approval timestamp does not match aggregate human review.');
}
const requiresApprovedImages = config.segments.some((segment) =>
  (segment.assets || []).some((asset) => ['character', 'location', 'prop'].includes(asset.assetType)));
const approvedImages = approvedManifestPaths(imageManifest, options.projectRoot, requiresApprovedImages);
let assetRequirementCoverage = null;
if (config.schemaVersion === 'auto-episode-package/2.3') {
  const requirementRegistryPath = resolveFrom(options.projectRoot, state.assetRequirements?.registryPath, 'Asset requirement registry');
  const requirementRegistry = readJson(requirementRegistryPath, 'asset requirement registry');
  assetRequirementCoverage = validateAssetRequirements(requirementRegistry, state, options.projectRoot);
  for (const finalPath of assetRequirementCoverage.finalPaths) {
    if (!approvedImages.has(finalPath)) fail(`Asset requirement final path is not in the approved image manifest: ${finalPath}`);
  }
  const requirementWorkbookPath = resolveFrom(options.projectRoot, state.assetRequirements?.workbookPath, 'Image requirement workbook');
  if (!fs.existsSync(requirementWorkbookPath) || !fs.statSync(requirementWorkbookPath).isFile()) fail('Image requirement workbook is missing.');
  const requirementWorkbookResultPath = resolveFrom(options.projectRoot, state.assetRequirements?.workbookResultPath, 'Image requirement workbook result');
  const requirementWorkbookResult = readJson(requirementWorkbookResultPath, 'image requirement workbook result');
  validateWorkbookFile(options.projectRoot, requirementWorkbookPath, requirementWorkbookResultPath, 'requirements');
  if (requirementWorkbookResult.schemaVersion !== 'auto-asset-requirements-workbook-result/1.0' || requirementWorkbookResult.projectId !== state.project?.id || requirementWorkbookResult.validation !== 'passed' || requirementWorkbookResult.status !== 'COMPLETE') {
    fail('Image requirement workbook result is not a validated COMPLETE result.');
  }
  if (fileHash(requirementRegistryPath).toLowerCase() !== String(requirementWorkbookResult.sourceRegistrySha256 || '').toLowerCase()) {
    fail('Image requirement workbook is stale relative to asset-requirements.json.');
  }
  if (Number(requirementWorkbookResult.requiredVersions) !== assetRequirementCoverage.required || Number(requirementWorkbookResult.validExistingVersions) !== assetRequirementCoverage.validExisting || Number(requirementWorkbookResult.validGeneratedVersions) !== assetRequirementCoverage.validGenerated || Number(requirementWorkbookResult.missingVersions) !== 0 || Number(requirementWorkbookResult.invalidVersions) !== 0 || Number(requirementWorkbookResult.pendingHumanReviewVersions) !== 0) {
    fail('Image requirement workbook coverage does not match asset-requirements.json.');
  }
  if (state.assetRequirements?.status !== 'COMPLETE' || Number(state.assetRequirements?.missingVersions) !== 0 || Number(state.assetRequirements?.invalidVersions) !== 0 || Number(state.assetRequirements?.pendingHumanReviewVersions) !== 0) {
    fail('Auto state asset requirement coverage is not COMPLETE.');
  }
}
const soundManifestPath = resolveFrom(options.projectRoot, state.preVideoDelivery.soundReferenceManifestPath, 'Sound manifest');
const soundManifest = readYaml(soundManifestPath, 'sound reference manifest');
if (soundManifest.project_id !== state.project?.id) fail('Sound reference manifest project ID does not match Auto state.');
const approvedSounds = validateSoundManifest(soundManifest, options.projectRoot);

const workbookInputPath = resolveFrom(options.projectRoot, state.assetWorkbook?.inputPath, 'Workbook input');
const workbookInput = readJson(workbookInputPath, 'asset workbook input');
if (workbookInput.projectId !== state.project?.id) fail('Workbook input project ID does not match Auto state.');
if (workbookInput.approvalStatus !== 'approved' || workbookInput.approvedAt !== state.aggregateAssetReview.reviewedAt) {
  fail('Workbook input approval does not match aggregate human review.');
}
for (const asset of workbookInput.assets || []) {
  for (const image of asset.images || []) {
    if (image.approvalStatus !== 'approved' || image.approvedAt !== workbookInput.approvedAt || !image.sha256) {
      fail(`Workbook input contains an unapproved or unhashed image: ${asset.assetId || image.source}`);
    }
  }
}
const workbookPath = resolveFrom(options.projectRoot, state.assetWorkbook?.path, 'Asset workbook');
const workbookResultPath = resolveFrom(options.projectRoot, state.assetWorkbook?.resultPath, 'Workbook result');
if (!fs.existsSync(workbookPath) || !fs.statSync(workbookPath).isFile()) fail(`Missing asset workbook: ${workbookPath}`);
const workbookResult = readJson(workbookResultPath, 'asset workbook result');
validateWorkbookFile(options.projectRoot, workbookPath, workbookResultPath, 'assets');
if (workbookResult.sourceInputSha256 !== fileHash(workbookInputPath)) fail('Asset workbook input changed since generation.');
if (workbookResult.validation !== 'passed' || workbookResult.approvalStatus !== 'approved' || workbookResult.approvedAt !== state.aggregateAssetReview.reviewedAt) {
  fail('Asset workbook validation or approval timestamp is invalid.');
}
if (workbookResult.projectId !== state.project?.id) fail('Workbook result project ID does not match Auto state.');
const workbookSources = normalizedPathSet((workbookResult.approvedSourcePaths || []).map((item) => resolveFrom(options.projectRoot, item, 'Workbook approved image')));
assertSameSet(workbookSources, approvedImages, 'Workbook approved image set');

if (!Array.isArray(config.promptCharacterAliases)) fail('Config must define promptCharacterAliases as an array.');
const hasCharacterAssets = config.segments.some((segment) => (segment.assets || []).some((asset) => asset.assetType === 'character'));
if (hasCharacterAssets && config.promptCharacterAliases.length === 0) fail('Character assets require promptCharacterAliases.');
if (!Array.isArray(config.segments) || config.segments.length === 0) fail('Config has no segments.');
const segmentIds = new Set();
let totalSegmentDuration = 0;
for (const [segmentIndex, segment] of config.segments.entries()) {
  const expectedSegmentId = `SEG${String(segmentIndex + 1).padStart(3, '0')}`;
  if (segment.id !== expectedSegmentId || segmentIds.has(segment.id)) fail(`Segments must be unique, contiguous and ordered. Expected ${expectedSegmentId}, found ${segment.id || 'EMPTY'}.`);
  if (config.schemaVersion === 'auto-episode-package/2.3' && segment.folder !== segment.id) fail(`${segment.id} final pre-video folder must be named exactly ${segment.id}.`);
  segmentIds.add(segment.id);
  totalSegmentDuration += Number(segment.durationSeconds);
  if (typeof segment.sameSceneAsPrevious !== 'boolean') fail(`${segment.id} must define sameSceneAsPrevious.`);
  if (segment.promptStatus !== 'complete_local_prompt_video_generation_not_executed') fail(`${segment.id} promptStatus is not final pre-video.`);
  for (const asset of segment.assets || []) {
    if (['auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion) && (typeof asset.semanticClass !== 'string' || !asset.semanticClass.trim())) {
      fail(`${segment.id} ${asset.mixedToken} lacks semanticClass.`);
    }
    if (asset.required !== true || asset.approvalStatus !== 'approved' || asset.slotStatus !== 'package_slot_verified') {
      fail(`${segment.id} ${asset.mixedToken} is not required, approved and package-slot verified.`);
    }
    const source = resolveFrom(options.projectRoot, asset.source, `${segment.id} ${asset.mixedToken}`);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) fail(`Required asset is missing: ${source}`);
    const key = path.normalize(source).toLowerCase();
    if (['character', 'location', 'prop'].includes(asset.assetType) && !approvedImages.has(key)) {
      fail(`${segment.id} visual asset is not approved in the image manifest: ${asset.source}`);
    }
    if (['character_voice', 'environment_audio', 'sound_effect'].includes(asset.assetType) && !approvedSounds.has(key)) {
      fail(`${segment.id} sound asset is not approved in the sound manifest: ${asset.source}`);
    }
  }
  const handoffPath = resolveFrom(options.projectRoot, segment.tscHandoffSource, `${segment.id} handoff`);
  const handoff = readYaml(handoffPath, `${segment.id} handoff`);
  if (handoff.project_id !== state.project?.id) fail(`${segment.id} handoff project ID does not match Auto state.`);
  validateHandoff(handoff, segment, (segment.assets || []).length, productionProfile, ['auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion), videoBackend);
}
if (config.schemaVersion === 'auto-episode-package/2.3') {
  if (Number(config.declaredSegmentCount) !== segmentIds.size) fail(`declaredSegmentCount ${config.declaredSegmentCount} does not match ${segmentIds.size} unique configured segments.`);
  const targetDuration = Number(config.targetDurationSeconds || state.project?.targetDurationSeconds);
  if (!Number.isFinite(targetDuration) || targetDuration <= 0 || Math.abs(totalSegmentDuration - targetDuration) > 0.01) {
    fail(`Segment durations total ${totalSegmentDuration}s but targetDurationSeconds is ${targetDuration || 'missing'}.`);
  }
  const progressPath = resolveFrom(options.projectRoot, state.segmentPlan?.progressAuditPath || 'segment-progress.json', 'Segment progress audit');
  const progress = readJson(progressPath, 'segment progress audit');
  if (progress.schemaVersion !== 'auto-segment-progress/1.0' || path.resolve(progress.projectRoot || '') !== options.projectRoot || progress.status !== 'complete' || Number(progress.declaredSegments) !== segmentIds.size || Number(progress.uniqueSegments) !== segmentIds.size || Number(progress.totalDurationSeconds) !== totalSegmentDuration || Number(progress.targetDurationSeconds) !== targetDuration) {
    fail('Segment progress audit does not match the complete configured segment plan.');
  }
  for (const label of ['script-verbatim.txt', 'storyboard-execution.txt', 'tsc-handoff.yaml', 'prompt.txt']) {
    if (Number(progress.missingArtifacts?.[label]?.count) !== 0 || (progress.missingArtifacts?.[label]?.segmentIds || []).length !== 0) {
      fail(`Segment progress audit still reports missing ${label} artifacts.`);
    }
  }
  if (Number(state.segmentPlan?.declaredSegmentCount) !== segmentIds.size || Number(state.segmentPlan?.uniqueSegmentCount) !== segmentIds.size || Number(state.segmentPlan?.totalDurationSeconds) !== totalSegmentDuration || state.segmentPlan?.status !== 'complete') {
    fail('Auto state segmentPlan does not match the unique configured segment plan.');
  }
}

if (config.deliveryLayout && !['episode', 'segments_at_root'].includes(config.deliveryLayout)) fail('Unsupported deliveryLayout.');
const formalRoot = state.preVideoDelivery.formalDeliveryRoot
  ? resolveFrom(options.projectRoot, state.preVideoDelivery.formalDeliveryRoot, 'Formal delivery root')
  : config.deliveryLayout === 'segments_at_root'
    ? resolveFrom(path.dirname(options.config), config.outputRoot, 'Package output root')
    : path.join(resolveFrom(path.dirname(options.config), config.outputRoot, 'Package output root'), config.episodeFolder);
if (!fs.existsSync(formalRoot) || !fs.statSync(formalRoot).isDirectory()) fail(`Formal delivery root is missing: ${formalRoot}`);
const contentReview = validateContentReview({ root: options.projectRoot, configPath: options.config, config, state, formalRoot });
const actualSegmentNames = listNames(formalRoot, 'Formal delivery').filter((name) => /^SEG\d+/.test(name));
if (!sameNames(actualSegmentNames, config.segments.map((segment) => segment.folder))) fail('Formal delivery contains stale or unexpected segment folders.');

const requiredEpisodeFiles = [
  REVIEW_FILE,
  'script-source.txt',
  'script-coverage-report.md',
  'production-brief.md',
  'asset-bible.yaml',
  '资产总表.xlsx',
  'asset-workbook-result.json',
  'look-lock.md',
  'reference-manifest.yaml',
  'auto-state.json',
  'image-delivery-manifest.json',
  'sound-reference-manifest.yaml',
  'release-report.md',
];
if (['auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion)) {
  requiredEpisodeFiles.push(config.layout?.productionProfileFile || 'production-profile.json');
}
if (config.schemaVersion === 'auto-episode-package/2.3') requiredEpisodeFiles.push(
  'project-inventory.json',
  'script-preview.md',
  'asset-requirements.json',
  '生图需求全集.xlsx',
  'asset-requirements-workbook-result.json',
  'segment-progress.json',
);
for (const name of requiredEpisodeFiles) {
  const target = path.join(formalRoot, name);
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) fail(`Formal delivery is missing ${name}.`);
}
assertSameText(options.state, path.join(formalRoot, 'auto-state.json'), 'auto-state.json');
if (fileHash(workbookPath) !== fileHash(path.join(formalRoot, '资产总表.xlsx'))) fail('Packaged asset workbook differs from the validated source workbook.');
if (['auto-episode-package/2.2', 'auto-episode-package/2.3'].includes(config.schemaVersion)) {
  const packagedProfile = readJson(path.join(formalRoot, config.layout.productionProfileFile), 'packaged production profile');
  if (!isDeepStrictEqual(packagedProfile, config.productionProfile)) fail('Packaged production profile differs from episode configuration.');
  for (const name of config.schemaVersion === 'auto-episode-package/2.3' ? ['project-inventory.json', 'script-preview.md', 'asset-requirements.json', '生图需求全集.xlsx', 'asset-requirements-workbook-result.json', 'segment-progress.json'] : []) {
    const source = path.join(options.projectRoot, name);
    const packaged = path.join(formalRoot, name);
    if (fileHash(source) !== fileHash(packaged)) fail(`${name} differs between the working project and formal delivery.`);
  }
}

const expectedSegmentEntries = ['资产', 'prompt.txt', 'script-verbatim.txt', 'storyboard-execution.txt', 'tsc-handoff.yaml', '素材映射.txt'];
const expectedAssetDirectories = ['场景', '道具', '人物', '声音参考'];
for (const segment of config.segments) {
  const segmentRoot = path.join(formalRoot, segment.folder);
  if (!sameNames(listNames(segmentRoot, `${segment.id} package`), expectedSegmentEntries)) {
    fail(`${segment.id} formal package must contain exactly the six fixed entries.`);
  }
  if (!sameNames(listNames(path.join(segmentRoot, '资产'), `${segment.id} asset root`), expectedAssetDirectories)) {
    fail(`${segment.id} asset root must contain exactly the four fixed directories.`);
  }
   parseMapping(path.join(segmentRoot, '素材映射.txt'), segment.assets || [], segment.id);
  for (const asset of segment.assets || []) {
    const packagedAsset = path.join(segmentRoot, asset.destination);
    if (!fs.existsSync(packagedAsset) || !fs.statSync(packagedAsset).isFile()) {
      fail(`${segment.id} packaged asset is missing: ${packagedAsset}`);
    }
    const sourceAsset = resolveFrom(options.projectRoot, asset.source, `${segment.id} ${asset.mixedToken} source`);
    if (fileHash(sourceAsset) !== fileHash(packagedAsset)) fail(`${segment.id} packaged asset differs from its approved source: ${asset.destination}`);
  }
  for (const [sourceKey, packageName] of [
    ['promptSource', 'prompt.txt'],
    ['scriptVerbatimSource', 'script-verbatim.txt'],
    ['storyboardExecutionSource', 'storyboard-execution.txt'],
    ['tscHandoffSource', 'tsc-handoff.yaml'],
  ]) {
    assertSameText(resolveFrom(options.projectRoot, segment[sourceKey], `${segment.id} ${sourceKey}`), path.join(segmentRoot, packageName), `${segment.id} ${packageName}`);
  }
}

const forbiddenVideoArtifacts = walkFiles(formalRoot).filter((filePath) =>
  /\.(mp4|mov|mkv|webm|avi)$/i.test(filePath) || /(^|[\\/])(libtv-result|take-review)\.(json|ya?ml)$/i.test(filePath));
if (forbiddenVideoArtifacts.length) fail(`Formal pre-video delivery contains video-stage artifacts: ${forbiddenVideoArtifacts.join(', ')}`);

if (options.finalize) {
  const now = new Date().toISOString();
  const finalState = JSON.parse(JSON.stringify(state));
  finalState.stage = 'pre_video_delivery_complete';
  finalState.status = 'completed';
  finalState.blockers = [];
  finalState.preVideoDelivery.status = 'complete';
  finalState.preVideoDelivery.formalDeliveryRoot = formalRoot;
  finalState.preVideoDelivery.scriptCoveragePercent = 100;
  finalState.preVideoDelivery.allSourceLinesMappedToTextualExecution = true;
  finalState.preVideoDelivery.allSourceLinesEnactedInPrompts = true;
  finalState.preVideoDelivery.generationSegmentsWithTscHandoffs = config.segments.length;
  finalState.preVideoDelivery.generationSegmentsWithTscPrompts = config.segments.length;
  finalState.preVideoDelivery.allRequiredReferencesResolved = true;
  finalState.preVideoDelivery.allGeneratedImageFilesExist = true;
  finalState.preVideoDelivery.allPromptsComplete = true;
  finalState.preVideoDelivery.promptValidation = 'passed';
  finalState.preVideoDelivery.packageValidation = 'passed';
  finalState.preVideoDelivery.contentReview = contentReview;
  finalState.preVideoDelivery.validatedAt = now;
  finalState.preVideoDelivery.deliveredAt = now;
  finalState.video = { inScope: false, generated: 0, status: 'excluded_by_control_mode' };
  finalState.updatedAt = now;
  const stateTargets = [...new Set([options.state, path.join(formalRoot, 'auto-state.json')])];
  writeJsonFilesAtomic(stateTargets, finalState);
}

console.log(JSON.stringify({
  projectRoot: options.projectRoot,
  formalDeliveryRoot: formalRoot,
  productionProfile: productionProfile.profileId,
  videoBackend,
  segments: config.segments.length,
  approvedImages: approvedImages.size,
  approvedSounds: approvedSounds.size,
  workbookImages: workbookResult.embeddedImageCount,
  requiredAssetVersions: assetRequirementCoverage?.required ?? null,
  videoUsage: 0,
  finalized: options.finalize,
  contentReview,
  validation: 'passed',
}));

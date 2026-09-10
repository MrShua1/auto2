#!/usr/bin/env node

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const scriptsRoot = path.resolve(__dirname, '..');
const scanner = path.join(scriptsRoot, 'scan-project-root.cjs');
const workbookBuilder = path.join(scriptsRoot, 'build-image-requirements-workbook.ps1');
const segmentAuditor = path.join(scriptsRoot, 'audit-segment-progress.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'auto-project-intake-'));

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function run(command, args) {
  return spawnSync(command, args, { encoding: 'utf8', cwd: path.resolve(scriptsRoot, '..'), env: { ...process.env, PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH } });
}

function runWorkbook() {
  const invocation = `try { & '${workbookBuilder.replace(/'/g, "''")}' -ProjectRoot '${temporary.replace(/'/g, "''")}' -Force } catch { [Console]::Error.WriteLine($_.Exception.ToString()); [Console]::Error.WriteLine($_.ScriptStackTrace); exit 1 }`;
  return run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', invocation]);
}

function writeRegistry(status, validationStatus, generationStatus, confirmationEvidence) {
  const assetPath = path.join(temporary, 'generated', 'CHAR001.png');
  const registry = {
    schemaVersion: 'auto-asset-requirements/1.0',
    projectId: 'project-intake-smoke',
    projectRoot: temporary,
    scriptSource: '剧本.txt',
    scriptSha256: hash(path.join(temporary, '剧本.txt')),
    rows: [{
      assetType: 'character',
      semanticClass: 'character_identity',
      entityId: 'CHAR001',
      name: 'Character One',
      versionId: 'CHAR001-BASE',
      characterSourceId: 'CHAR001',
      wardrobeId: '',
      characterState: 'base',
      sceneTime: '',
      propState: '',
      episodes: ['EP001'],
      scenes: ['SCENE001'],
      scriptEvidence: ['Character One enters.'],
      existingFiles: [],
      confirmationEvidence,
      validationStatus,
      validationIssues: [],
      generationRequired: ['missing', 'rejected_invalid'].includes(validationStatus),
      generationPrompt: 'Character One asset prompt.',
      generationStatus,
      finalPath: 'generated/CHAR001.png',
      finalSha256: hash(assetPath),
    }],
    coverage: {},
    issues: status === 'NEED_FIX' ? ['CHAR001-BASE: pending human review'] : [],
    status,
    review: {
      scriptRequirementCoverage: 'passed',
      humanApproval: status === 'COMPLETE' ? 'approved' : 'pending',
      reviewedAt: status === 'COMPLETE' ? '2026-09-04T00:00:00.000Z' : '',
    },
  };
  fs.writeFileSync(path.join(temporary, 'asset-requirements.json'), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

try {
  fs.mkdirSync(path.join(temporary, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(temporary, 'generated'), { recursive: true });
  fs.writeFileSync(path.join(temporary, '剧本.txt'), 'Character One enters.\n', 'utf8');
  fs.writeFileSync(path.join(temporary, 'scripts', 'episode-02.md'), 'Episode 2\n', 'utf8');
  fs.writeFileSync(path.join(temporary, 'prompt.txt'), 'generated prompt\n', 'utf8');
  fs.writeFileSync(path.join(temporary, 'report.md'), 'generated report\n', 'utf8');
  fs.writeFileSync(path.join(temporary, 'reference.png'), 'not decoded by Auto', 'utf8');
  fs.writeFileSync(path.join(temporary, 'generated', 'CHAR001.png'), 'generated file existence only', 'utf8');

  const scan = run(process.execPath, [scanner, '--project-root', temporary]);
  assert.strictEqual(scan.status, 0, `${scan.stdout}\n${scan.stderr}`);
  const inventory = JSON.parse(fs.readFileSync(path.join(temporary, 'project-inventory.json'), 'utf8'));
  assert.deepStrictEqual(inventory.scripts.map((item) => item.path).sort(), ['scripts\\episode-02.md', '剧本.txt'].sort());
  assert.ok(!inventory.otherRelevantFiles.some((item) => ['prompt.txt', 'report.md'].includes(item.path)));
  assert.strictEqual(inventory.images.length, 2);
  assert.ok(inventory.images.every((item) => !('width' in item) && !('height' in item)));

  const segmentConfig = {
    schemaVersion: 'auto-episode-package/2.3',
    videoBackend: 'unselected',
    targetDurationSeconds: 15,
    declaredSegmentCount: 669,
    segments: [{
      id: 'SEG001',
      durationSeconds: 15,
      scriptVerbatimSource: 'segments/SEG001/script-verbatim.txt',
      storyboardExecutionSource: 'segments/SEG001/storyboard-execution.txt',
      tscHandoffSource: 'segments/SEG001/tsc-handoff.yaml',
      promptSource: 'segments/SEG001/prompt.txt',
    }],
  };
  fs.writeFileSync(path.join(temporary, 'segment-config.json'), `${JSON.stringify(segmentConfig, null, 2)}\n`, 'utf8');
  const badSegmentCount = run(process.execPath, [segmentAuditor, '--project-root', temporary, '--config', 'segment-config.json']);
  assert.notStrictEqual(badSegmentCount.status, 0);
  assert.match(`${badSegmentCount.stdout}\n${badSegmentCount.stderr}`, /declaredSegmentCount 669 does not match 1/);

  segmentConfig.declaredSegmentCount = 2;
  segmentConfig.segments.push({ ...segmentConfig.segments[0] });
  fs.writeFileSync(path.join(temporary, 'segment-config.json'), `${JSON.stringify(segmentConfig, null, 2)}\n`, 'utf8');
  const duplicateSegment = run(process.execPath, [segmentAuditor, '--project-root', temporary, '--config', 'segment-config.json']);
  assert.notStrictEqual(duplicateSegment.status, 0);
  assert.match(`${duplicateSegment.stdout}\n${duplicateSegment.stderr}`, /duplicate IDs/);

  segmentConfig.segments[1].id = 'SEG003';
  fs.writeFileSync(path.join(temporary, 'segment-config.json'), `${JSON.stringify(segmentConfig, null, 2)}\n`, 'utf8');
  const nonContiguousSegment = run(process.execPath, [segmentAuditor, '--project-root', temporary, '--config', 'segment-config.json']);
  assert.notStrictEqual(nonContiguousSegment.status, 0);
  assert.match(`${nonContiguousSegment.stdout}\n${nonContiguousSegment.stderr}`, /Expected SEG002, found SEG003/);

  segmentConfig.declaredSegmentCount = 1;
  segmentConfig.segments = [segmentConfig.segments[0]];
  segmentConfig.targetDurationSeconds = 20;
  fs.writeFileSync(path.join(temporary, 'segment-config.json'), `${JSON.stringify(segmentConfig, null, 2)}\n`, 'utf8');
  const durationMismatch = run(process.execPath, [segmentAuditor, '--project-root', temporary, '--config', 'segment-config.json']);
  assert.notStrictEqual(durationMismatch.status, 0);
  assert.match(`${durationMismatch.stdout}\n${durationMismatch.stderr}`, /total 15s but project targetDurationSeconds is 20s/);

  segmentConfig.targetDurationSeconds = 15;
  fs.writeFileSync(path.join(temporary, 'segment-config.json'), `${JSON.stringify(segmentConfig, null, 2)}\n`, 'utf8');
  const segmentProgress = run(process.execPath, [segmentAuditor, '--project-root', temporary, '--config', 'segment-config.json', '--output', 'segment-progress-test.json']);
  assert.strictEqual(segmentProgress.status, 0, `${segmentProgress.stdout}\n${segmentProgress.stderr}`);
  const progress = JSON.parse(segmentProgress.stdout);
  assert.deepStrictEqual([progress.declaredSegments, progress.uniqueSegments, progress.missingArtifacts['script-verbatim.txt'].count, progress.missingArtifacts['storyboard-execution.txt'].count, progress.missingArtifacts['tsc-handoff.yaml'].count, progress.missingArtifacts['prompt.txt'].count], [1, 1, 1, 1, 1, 1]);

  writeRegistry('NEED_FIX', 'generated_pending_human_review', 'generated', []);
  const pending = runWorkbook();
  assert.strictEqual(pending.status, 0, `${pending.stdout}\n${pending.stderr}`);
  let workbookResult = JSON.parse(fs.readFileSync(path.join(temporary, 'asset-requirements-workbook-result.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.deepStrictEqual([workbookResult.status, workbookResult.pendingHumanReviewVersions], ['NEED_FIX', 1]);
  const pendingRegistryPath = path.join(temporary, 'asset-requirements.json');
  const pendingRegistry = JSON.parse(fs.readFileSync(pendingRegistryPath));
  pendingRegistry.issues = [];
  pendingRegistry.rows[0].validationIssues = ['Reference identity requires explicit user confirmation.'];
  fs.writeFileSync(pendingRegistryPath, JSON.stringify(pendingRegistry));
  const computedIssuesRun = runWorkbook();
  assert.strictEqual(computedIssuesRun.status, 0, computedIssuesRun.stderr);
  const checkWorkbook = run(process.execPath, ['-e', `const ExcelJS = require('exceljs'); const assert = require('assert'); (async () => { const b = new ExcelJS.Workbook(); await b.xlsx.readFile(process.argv[1]); assert.equal(b.getWorksheet('覆盖统计').getCell('G3').value, 'NEED_FIX'); const issues = b.getWorksheet('问题').getColumn(1).values.join(' '); assert.match(issues, /Reference identity/); assert.match(issues, /unresolved status/); })().catch(e => { console.error(e); process.exitCode = 1; });`, path.join(temporary, '生图需求全集.xlsx')]);
  assert.strictEqual(checkWorkbook.status, 0, checkWorkbook.stderr);
  const firstWorkbookHash = hash(path.join(temporary, '生图需求全集.xlsx'));

  writeRegistry('COMPLETE', 'approved_generated', 'approved', ['user-approved:2026-09-04T00:00:00.000Z']);
  const approved = runWorkbook();
  assert.strictEqual(approved.status, 0, `${approved.stdout}\n${approved.stderr}`);
  workbookResult = JSON.parse(fs.readFileSync(path.join(temporary, 'asset-requirements-workbook-result.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.deepStrictEqual([workbookResult.status, workbookResult.pendingHumanReviewVersions, workbookResult.validGeneratedVersions], ['COMPLETE', 0, 1]);
  assert.notStrictEqual(hash(path.join(temporary, '生图需求全集.xlsx')), firstWorkbookHash);

  const duplicate = JSON.parse(fs.readFileSync(path.join(temporary, 'asset-requirements.json'), 'utf8'));
  duplicate.rows.push({ ...duplicate.rows[0] });
  duplicate.coverage = {};
  fs.writeFileSync(path.join(temporary, 'asset-requirements.json'), `${JSON.stringify(duplicate, null, 2)}\n`, 'utf8');
  const duplicateResult = runWorkbook();
  assert.notStrictEqual(duplicateResult.status, 0);
  assert.match(`${duplicateResult.stdout}\n${duplicateResult.stderr}`, /Duplicate asset requirement versionId/);

  writeRegistry('COMPLETE', 'approved_generated', 'approved', ['user-approved:2026-09-04T00:00:00.000Z']);
  fs.appendFileSync(path.join(temporary, '剧本.txt'), 'Changed.\n', 'utf8');
  const staleScript = runWorkbook();
  assert.notStrictEqual(staleScript.status, 0);
  assert.match(`${staleScript.stdout}\n${staleScript.stderr}`, /Script source hash changed/);

  fs.writeFileSync(path.join(temporary, '剧本.txt'), 'Character One enters.\n', 'utf8');
  writeRegistry('COMPLETE', 'approved_generated', 'approved', ['user-approved:2026-09-04T00:00:00.000Z']);
  fs.appendFileSync(path.join(temporary, 'generated', 'CHAR001.png'), 'Changed.\n', 'utf8');
  const staleAsset = runWorkbook();
  assert.notStrictEqual(staleAsset.status, 0);
  assert.match(`${staleAsset.stdout}\n${staleAsset.stderr}`, /Valid asset hash mismatch/);

  console.log(JSON.stringify({ scannerClassification: 'passed', imageContentNotRead: 'passed', segmentCountInflationGate: 'passed', duplicateSegmentGate: 'passed', contiguousSegmentGate: 'passed', durationTotalGate: 'passed', missingArtifactsReportedSeparately: 'passed', pendingHumanReview: 'passed', humanApprovalComplete: 'passed', transactionalReplacement: 'passed', duplicateVersionGate: 'passed', staleScriptGate: 'passed', staleApprovedAssetGate: 'passed' }));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

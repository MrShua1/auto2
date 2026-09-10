#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const sharp = require('sharp');
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const categories = ['人物', '场景', '道具'];

async function validate(file, result, kind) {
  if (result.workbookSha256 !== hash(file)) throw new Error('Workbook changed since validation.');
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  const names = kind === 'assets' ? [...categories, '_索引'] : ['生图需求全集', '覆盖统计', '问题'];
  if (book.worksheets.map((sheet) => sheet.name).join('|') !== names.join('|')) throw new Error('Workbook sheet contract mismatch.');
  if (kind === 'assets') {
    const images = categories.reduce((sum, name) => sum + book.getWorksheet(name).getImages().length, 0);
    if (book.getWorksheet('_索引').state !== 'hidden' || images !== result.embeddedImageCount || Math.max(0, book.getWorksheet('_索引').actualRowCount - 1) !== images) throw new Error('Workbook image/index contract mismatch.');
  } else if (Math.max(0, book.getWorksheet('生图需求全集').actualRowCount - 1) !== result.generationRows) throw new Error('Workbook requirement row count mismatch.');
}

async function build(root, inputPath, kind, force) {
  const input = read(inputPath);
  const assetsMode = kind === 'assets';
  const output = path.join(root, assetsMode ? '资产总表.xlsx' : '生图需求全集.xlsx');
  const resultPath = path.join(root, assetsMode ? 'asset-workbook-result.json' : 'asset-requirements-workbook-result.json');
  if (!force && (fs.existsSync(output) || fs.existsSync(resultPath))) throw new Error('Workbook/result exists; use --force.');
  const temporary = `${output}.${crypto.randomUUID()}.tmp`;
  const book = new ExcelJS.Workbook();
  const result = { projectId: input.projectId, path: output, generatedAt: new Date().toISOString(), validation: 'passed', sourceInputSha256: hash(inputPath) };
  if (assetsMode) {
    if (input.schemaVersion !== 'auto-asset-workbook-input/1.0' || input.approvalStatus !== 'approved' || !input.approvedAt || !Array.isArray(input.assets)) throw new Error('Unapproved/invalid asset workbook input.');
    if (JSON.stringify(input.sheetOrder) !== JSON.stringify([...categories, '_索引']) || input.outputFile !== '资产总表.xlsx') throw new Error('Asset workbook layout mismatch.');
    const sheets = Object.fromEntries(categories.map((name) => [name, book.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] })]));
    for (const sheet of Object.values(sheets)) { sheet.addRow(['资产名称', '参考图 1']); sheet.getColumn(1).width = 30; }
    const index = book.addWorksheet('_索引', { state: 'hidden' });
    index.addRow(['asset_id', 'category', 'asset_name', 'image_role', 'source_path', 'approval_status', 'approved_at', 'visible_sheet', 'visible_cell']);
    const ids = new Set(); const sources = new Set(); let embedded = 0;
    for (const asset of input.assets) {
      if (!asset.assetId || ids.has(asset.assetId) || !asset.name || !sheets[asset.category] || !asset.images?.length) throw new Error('Invalid/duplicate workbook asset.');
      ids.add(asset.assetId);
      const sheet = sheets[asset.category]; const row = sheet.addRow([asset.name]); row.height = 140;
      for (const [imageIndex, image] of asset.images.entries()) {
        const file = path.resolve(root, image.source); const key = file.toLowerCase();
        if (sources.has(key) || !image.role || image.approvalStatus !== 'approved' || image.approvedAt !== input.approvedAt || hash(file).toLowerCase() !== String(image.sha256).toLowerCase()) throw new Error('Unapproved/duplicate/changed workbook image.');
        sources.add(key);
        const buffer = fs.readFileSync(file); const dimensions = await sharp(buffer).metadata();
        if (!['png', 'jpeg', 'gif'].includes(dimensions.format) || !dimensions.width || !dimensions.height) throw new Error('Workbook image format must be PNG/JPEG/GIF.');
        const id = book.addImage({ buffer, extension: dimensions.format });
        const scale = Math.min(220 / dimensions.width, 125 / dimensions.height);
        const width = dimensions.width * scale; const height = dimensions.height * scale;
        const column = imageIndex + 2; sheet.getColumn(column).width = 34; sheet.getCell(1, column).value = `参考图 ${imageIndex + 1}`;
        sheet.addImage(id, { tl: { col: column - 1 + (230 - width) / 460, row: row.number - 1 + (186 - height) / 372 }, ext: { width, height }, editAs: 'oneCell' });
        index.addRow([asset.assetId, asset.category, asset.name, image.role, file, 'approved', image.approvedAt, asset.category, sheet.getCell(row.number, column).address]); embedded++;
      }
    }
    Object.assign(result, { schemaVersion: 'auto-asset-workbook-result/1.0', sheetNames: [...categories, '_索引'], hiddenIndex: true, canonicalAssetCount: ids.size, embeddedImageCount: embedded, indexRowCount: embedded, approvalStatus: 'approved', approvedAt: input.approvedAt, approvedSourcePaths: [...sources].sort() });
  } else {
    if (input.schemaVersion !== 'auto-asset-requirements/1.0' || !Array.isArray(input.rows) || hash(path.resolve(root, input.scriptSource)).toLowerCase() !== String(input.scriptSha256).toLowerCase()) throw new Error('Requirement registry/source invalid.');
    const requirements = book.addWorksheet('生图需求全集'); const coverage = book.addWorksheet('覆盖统计'); const issues = book.addWorksheet('问题');
    requirements.addRow(['资产类型', '实体ID', '名称', '版本ID', '人物源ID', '服装ID', '人物状态', '场景时段', '道具状态', '集数', '场次', '剧本证据', '已有文件', '校验状态', '生图提示词', '生成状态', '最终路径']);
    const generation = input.rows.filter((row) => row.generationRequired);
    for (const row of generation) requirements.addRow([row.assetType, row.entityId, row.name, row.versionId, row.characterSourceId, row.wardrobeId, row.characterState, row.sceneTime, row.propState, (row.episodes || []).join('\n'), (row.scenes || []).join('\n'), (row.scriptEvidence || []).join('\n'), (row.existingFiles || []).join('\n'), row.validationStatus, row.generationPrompt, row.generationStatus, row.finalPath]);
    const counts = { validExistingVersions: 0, validGeneratedVersions: 0, missingVersions: 0, invalidVersions: 0, pendingHumanReviewVersions: 0 };
    const keyFor = { approved_existing: 'validExistingVersions', approved_generated: 'validGeneratedVersions', missing: 'missingVersions', rejected_invalid: 'invalidVersions', pending_human_review: 'pendingHumanReviewVersions', generated_pending_human_review: 'pendingHumanReviewVersions' };
    for (const row of input.rows) { if (!keyFor[row.validationStatus]) throw new Error('Unknown requirement status.'); counts[keyFor[row.validationStatus]]++; }
    coverage.addRow(['范围', '需求版本', '有效版本', '缺失版本', '人工判定不合格', '待人工确认', '状态']);
    coverage.addRow(['全剧', input.rows.length, counts.validExistingVersions + counts.validGeneratedVersions, counts.missingVersions, counts.invalidVersions, counts.pendingHumanReviewVersions, input.status]);
    const episodeCoverage = [...new Set(input.rows.flatMap((row) => row.episodes || []))].sort().map((episodeId) => {
      const rows = input.rows.filter((row) => row.episodes.includes(episodeId));
      return { episodeId, requiredVersions: rows.length, validVersions: rows.filter((row) => ['approved_existing', 'approved_generated'].includes(row.validationStatus)).length, missingVersions: rows.filter((row) => row.validationStatus === 'missing').length, invalidVersions: rows.filter((row) => row.validationStatus === 'rejected_invalid').length, pendingHumanReviewVersions: rows.filter((row) => ['pending_human_review', 'generated_pending_human_review'].includes(row.validationStatus)).length };
    });
    for (const ep of episodeCoverage) {
      ep.status = ep.validVersions === ep.requiredVersions && !ep.missingVersions && !ep.invalidVersions && !ep.pendingHumanReviewVersions ? 'COMPLETE' : 'NEED_FIX';
      coverage.addRow([ep.episodeId, ep.requiredVersions, ep.validVersions, ep.missingVersions, ep.invalidVersions, ep.pendingHumanReviewVersions, ep.status]);
    }
    const computedIssues = input.rows.flatMap((row) => [
      ...(row.validationIssues || []).filter((issue) => String(issue).trim()).map((issue) => `${row.versionId}: ${issue}`),
      ...(!['approved_existing', 'approved_generated'].includes(row.validationStatus) ? [`${row.versionId}: unresolved status ${row.validationStatus}`] : []),
      ...(row.generationStatus === 'failed' ? [`${row.versionId}: image generation failed`] : []),
    ]);
    issues.addRow(['问题']); for (const issue of new Set([...computedIssues, ...(input.issues || [])].map(String).filter((issue) => issue.trim()))) issues.addRow([issue]);
    Object.assign(result, { schemaVersion: 'auto-asset-requirements-workbook-result/1.0', sourceRegistrySha256: hash(inputPath), requiredVersions: input.rows.length, generationRows: generation.length, ...counts, episodeCoverage, status: input.status });
  }
  for (const sheet of book.worksheets) { sheet.getRow(1).font = { bold: true }; sheet.eachRow((row) => { row.alignment = { wrapText: true, vertical: 'top' }; }); }
  const tempResult = `${resultPath}.${crypto.randomUUID()}.tmp`;
  const backups = [];
  try {
    await book.xlsx.writeFile(temporary);
    result.workbookSha256 = hash(temporary);
    await validate(temporary, result, kind);
    fs.writeFileSync(tempResult, JSON.stringify(result, null, 2));
    const installed = [];
    try {
      for (const target of [output, resultPath]) if (fs.existsSync(target)) { const backup = `${target}.${crypto.randomUUID()}.bak`; fs.renameSync(target, backup); backups.push([target, backup]); }
      fs.renameSync(temporary, output); installed.push(output);
      fs.renameSync(tempResult, resultPath); installed.push(resultPath);
    }
    catch (error) { for (const target of installed) if (fs.existsSync(target)) fs.unlinkSync(target); for (const [target, backup] of backups) fs.renameSync(backup, target); throw error; }
    for (const [, backup] of backups) fs.unlinkSync(backup);
    return result;
  } finally { for (const file of [temporary, tempResult]) if (fs.existsSync(file)) fs.unlinkSync(file); }
}

if (require.main === module) {
  const [mode, rootArg, inputArg, kind, force] = process.argv.slice(2);
  const root = path.resolve(rootArg || '.');
  const operation = mode === 'validate' ? validate(path.resolve(root, inputArg), read(path.resolve(root, kind)), force) : mode === 'build' && ['assets', 'requirements'].includes(kind) ? build(root, path.resolve(root, inputArg), kind, force === '--force') : Promise.reject(new Error('Usage: workbook-openxml.cjs build ROOT INPUT assets|requirements [--force] or validate ROOT WORKBOOK RESULT KIND'));
  operation.then((result) => console.log(JSON.stringify(result || { validation: 'passed' }))).catch((error) => { console.error(error.stack); process.exitCode = 1; });
}
module.exports = { build, validate };

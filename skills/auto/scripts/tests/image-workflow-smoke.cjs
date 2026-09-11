// Synthetic fixture only. Approval records here test gates, not real human consent.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const crypto=require('node:crypto');const {spawnSync}=require('node:child_process');
const ExcelJS=require('exceljs');const YAML=require('yaml');
const {reserve}=require('../reserve-image-attempt.cjs');
const root=process.argv[2];const scripts=path.resolve(__dirname,'..');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2));
function run(file,args=[],ok=true){
  const ps=file.endsWith('.ps1');
  const result=spawnSync(ps?(process.platform==='win32'?'powershell':'pwsh'):process.execPath,ps?['-NoProfile','-File',path.join(scripts,file),...args]:[path.join(scripts,file),...args],{encoding:'utf8'});
   assert.ifError(result.error);
   if(ok)assert.equal(result.status,0,result.stdout+result.stderr);else {assert.notEqual(result.status,null);assert.notEqual(result.status,0);}
  return result;
}
async function main(){
  const config=read('episode-package-config.json');const registry=read('asset-requirements.json');
  const state=read('auto-state.json');const approvedAt=state.aggregateAssetReview.reviewedAt;
  fs.mkdirSync(path.join(root,'generated'),{recursive:true});
  fs.writeFileSync(path.join(root,'TEST-ONLY.txt'),'Synthetic offline approvals. NOT a production delivery.');
  const row={assetType:'location',semanticClass:'location',entityId:'LOC001',name:'Synthetic station',versionId:'LOC001-BASE',episodes:['EP001'],scenes:['SCENE001'],scriptEvidence:['清晨的空站台保持无人。'],existingFiles:[],confirmationEvidence:[],validationStatus:'missing',validationIssues:[],generationRequired:true,generationPrompt:'Synthetic station fixture',generationStatus:'planned',finalPath:'generated/LOC001.png',finalSha256:''};
  registry.rows=[row];registry.status='NEED_FIX';registry.review.humanApproval='pending';write('asset-requirements.json',registry);
  run('build-image-requirements-workbook.ps1',['-ProjectRoot',root,'-Force']);
  assert.equal(read('asset-requirements-workbook-result.json').generationRows,1);
  const ledger=path.join(root,'image-attempts.json');reserve(ledger,'LOC001-V1');
  assert.ok(process.env.AUTO_IMAGE_FIXTURE,'The bundled mock image plugin fixture is required');
  const generated=spawnSync('bun',[process.env.AUTO_IMAGE_FIXTURE,root],{encoding:'utf8',timeout:30000});
  assert.ifError(generated.error);assert.equal(generated.status,0,generated.stdout+generated.stderr);
  const receipt=JSON.parse(generated.stdout);assert.equal(receipt.mockPosts,1);assert.equal(receipt.paidRequests,0);
  const image=fs.readFileSync(receipt.filename);write('mock-image-receipt.json',receipt);
  fs.writeFileSync(path.join(root,row.finalPath),image,{flag:'wx'});
  const attempts=JSON.parse(fs.readFileSync(ledger));attempts.jobs['LOC001-V1'].attempts.at(-1).status='succeeded';write('image-attempts.json',attempts);
  assert.throws(()=>reserve(ledger,'LOC001-V1'));
  const replay=run('reserve-image-attempt.cjs',[ledger,'LOC001-V1'],false);
  assert.match(replay.stderr,/already succeeded/);assert.equal(read('image-attempts.json').attempts,1);
  Object.assign(row,{validationStatus:'generated_pending_human_review',generationRequired:false,generationStatus:'generated',finalSha256:hash(path.join(root,row.finalPath))});write('asset-requirements.json',registry);
  run('build-image-requirements-workbook.ps1',['-ProjectRoot',root,'-Force']);
  assert.equal(read('asset-requirements-workbook-result.json').pendingHumanReviewVersions,1);
  run('validate-prevideo-delivery.cjs',['--project-root',root,'--finalize'],false);
  Object.assign(row,{validationStatus:'approved_generated',generationStatus:'approved',confirmationEvidence:['SYNTHETIC_TEST_APPROVAL_NOT_REAL']});
  registry.status='COMPLETE';registry.review.humanApproval='approved';registry.review.reviewedAt=approvedAt;
  registry.coverage={fullSeriesRequiredVersions:1,validExistingVersions:0,validGeneratedVersions:1,missingVersions:0,invalidVersions:0,pendingHumanReviewVersions:0,generationRequiredVersions:0,byEpisode:[{episodeId:'EP001',requiredVersions:1,validVersions:1,missingVersions:0,invalidVersions:0,pendingHumanReviewVersions:0}]};
  write('asset-requirements.json',registry);
  const manifest=read('image-delivery-manifest.json');manifest.items=[{assetId:'LOC001',role:'location',path:row.finalPath,sha256:row.finalSha256,approvalStatus:'approved',approvedAt}];write('image-delivery-manifest.json',manifest);
  const input=read('asset-workbook-input.json');input.assets=[{assetId:'LOC001',category:'场景',name:'Synthetic station',images:[{role:'location',source:row.finalPath,sha256:row.finalSha256,approvalStatus:'approved',approvedAt}]}];write('asset-workbook-input.json',input);
  for(const file of ['build-asset-workbook.ps1','build-image-requirements-workbook.ps1'])run(file,['-ProjectRoot',root,'-Force']);
  const book=new ExcelJS.Workbook();await book.xlsx.readFile(path.join(root,'资产总表.xlsx'));
  const embedded=book.getWorksheet('场景').getImages();assert.equal(embedded.length,1);assert.ok(book.getImage(embedded[0].imageId).buffer.equals(image));
  const segment=config.segments[0];segment.assets=[{mixedToken:'{{Mixed 1}}',assetType:'location',semanticClass:'location',role:'location',source:row.finalPath,destination:'资产/场景/LOC001.png',required:true,approvalStatus:'approved',slotStatus:'package_slot_verified'}];
  const promptPath=path.join(root,segment.promptSource);
  fs.writeFileSync(promptPath,fs.readFileSync(promptPath,'utf8').replace('【角色清单】\n无人物。','【角色清单】\n把 {{Mixed 1}} 中清晨空置站台作为主体1。').replace('【资源引用】\n无外部参考。','【资源引用】\n{{Mixed 1}} 为主体1场景参考。').replaceAll('主体锁：无；','主体锁：主体1站台边界保持不变；'));
  const handoffPath=path.join(root,segment.tscHandoffSource);const handoff=YAML.parse(fs.readFileSync(handoffPath,'utf8'));
  handoff.references=[{mixed_token:'{{Mixed 1}}',required:true,availability:'available',approval_status:'approved',slot_status:'package_slot_verified'}];fs.writeFileSync(handoffPath,YAML.stringify(handoff));
  write('episode-package-config.json',config);
  const review=read('content-review.json');review.configSha256=hash(path.join(root,'episode-package-config.json'));review.segments[0].hashes.promptSource=hash(promptPath);review.segments[0].hashes.tscHandoffSource=hash(handoffPath);write('content-review.json',review);
  run('build-episode-segment-package.ps1',['-ConfigPath',path.join(root,'episode-package-config.json'),'-Force']);
  run('validate-prevideo-delivery.cjs',['--project-root',root,'--finalize']);
  const packaged=path.join(config.outputRoot,'第1集','SEG001');assert.equal(hash(path.join(packaged,segment.assets[0].destination)),row.finalSha256);
  assert.ok(fs.readFileSync(path.join(packaged,'素材映射.txt'),'utf8').includes('{{Mixed 1}}\tOK\tlocation'));
  const before=hash(path.join(root,'资产总表.xlsx'));
  fs.writeFileSync(path.join(root,row.finalPath),'corrupt');
  run('build-asset-workbook.ps1',['-ProjectRoot',root,'-Force'],false);assert.equal(hash(path.join(root,'资产总表.xlsx')),before);
  run('validate-prevideo-delivery.cjs',['--project-root',root,'--finalize'],false);
  fs.writeFileSync(path.join(root,row.finalPath),image);
  run('validate-prevideo-delivery.cjs',['--project-root',root,'--finalize']);
  console.log('Synthetic image workflow: requirement -> reserved mock image -> pending approval rejection -> test approval -> embedded PNG -> mapped final package -> corruption rejection -> recovery PASS');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

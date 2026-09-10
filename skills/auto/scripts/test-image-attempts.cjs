const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const assert=require('node:assert/strict');
const {reserve}=require('./reserve-image-attempt.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'auto-attempts-'));
const file=path.join(root,'ledger.json');
try{
  assert.equal(reserve(file,'job').number,1);
  assert.throws(()=>reserve(file,'job'),/unresolved/);
  for(const n of [2,3]){
    const s=JSON.parse(fs.readFileSync(file));s.jobs.job.attempts.at(-1).status='failed_or_unknown';fs.writeFileSync(file,JSON.stringify(s));
    assert.equal(reserve(file,'job').number,n);
  }
  const s=JSON.parse(fs.readFileSync(file));s.jobs.job.attempts.at(-1).status='failed';fs.writeFileSync(file,JSON.stringify(s));
  assert.throws(()=>reserve(file,'job'),/cap/);
  s.imageLimit=3;fs.writeFileSync(file,JSON.stringify(s));assert.throws(()=>reserve(file,'other'),/budget/);
  console.log('6 bounded image attempt tests passed.');
}finally{fs.rmSync(root,{recursive:true,force:true});}

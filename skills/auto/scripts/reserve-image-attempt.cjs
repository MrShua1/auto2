const fs = require('node:fs');
const path = require('node:path');
function reserve(file, jobId, cap = 3) {
  if (!jobId || !Number.isInteger(cap) || cap < 1) throw Error('Invalid job/cap');
  const lock = file + '.lock';
  const fd = fs.openSync(lock, 'wx');
  try {
    const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { jobs: {}, attempts: 0 };
    if (state.imageLimit !== undefined && state.attempts >= state.imageLimit) throw Error('Image budget exhausted');
    const job = state.jobs[jobId] || { attempts: [] };
    if (job.attempts.some(a => a.status === 'succeeded')) throw Error('Job already succeeded');
    if (job.attempts.some(a => a.status === 'reserved')) throw Error('Previous attempt unresolved; record its ended status first');
    if (job.attempts.length >= cap) throw Error('Attempt cap reached');
    const number = job.attempts.length + 1;
    const attempt = { id: number === 1 ? jobId : `${jobId}-A${number}`, number, status: 'reserved', reservedAt: new Date().toISOString(), charged_status: 'unknown' };
    job.attempts.push(attempt); state.jobs[jobId] = job; state.attempts++;
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); fs.renameSync(tmp, file);
    return attempt;
  } finally { fs.closeSync(fd); fs.unlinkSync(lock); }
}
module.exports = { reserve };
if (require.main === module) { try { console.log(JSON.stringify(reserve(path.resolve(process.argv[2]), process.argv[3], Number(process.argv[4] || 3)), null, 2)); } catch (e) { console.error(e.message); process.exitCode = 1; } }

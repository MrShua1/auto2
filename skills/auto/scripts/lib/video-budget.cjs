const fs = require('fs');
const crypto = require('crypto');

function reserveVideo(statePath, count, jobKey) {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error('Video output count must be a positive integer.');
  const lock = `${statePath}.video-lock`;
  const fd = fs.openSync(lock, 'wx');
  const temporary = `${statePath}.${crypto.randomUUID()}.tmp`;
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''));
    if (state.control?.mode === 'episode_prevideo' || state.control?.videoSideEffectsAllowed !== true || state.video?.authorization?.status !== 'authorized' || !state.video.authorization.explicitCommand || !state.video.authorization.authorizedAt || state.preVideoDelivery?.status !== 'complete') throw new Error('Video authorization changed or is missing.');
    const { videoUsed, videoLimit } = state.budget || {};
    if (!Number.isSafeInteger(videoUsed) || videoUsed < 0 || !Number.isSafeInteger(videoLimit) || videoLimit < 0 || videoUsed + count > videoLimit) throw new Error('Video output count exceeds remaining budget.');
    const reservations = state.budget.videoReservations || [];
    if (reservations.some((item) => item.jobKey === jobKey)) throw new Error('This video job is already reserved; reconcile it before retrying.');
    const entry = { id: crypto.randomUUID(), jobKey, count, reservedAt: new Date().toISOString(), status: 'reserved_attempt_no_automatic_refund' };
    state.budget.videoUsed += count;
    state.budget.videoReservations = [...reservations, entry];
    state.updatedAt = entry.reservedAt;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
    fs.renameSync(temporary, statePath);
    return entry;
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.closeSync(fd); fs.unlinkSync(lock);
  }
}

module.exports = { reserveVideo };

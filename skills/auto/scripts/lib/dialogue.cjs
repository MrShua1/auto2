function sourceDialogue(line) {
  if (/^\s*(?:[△【\[]|(?:人物|角色|场景|时间|地点|制作要求|全局规则|拍摄要求)[：:]|第.+集\s*$|(?:INT|EXT)\.)/i.test(line)) return null;
  const match = line.match(/^\s*([^：:\n]{1,60})[：:]\s*(.*)$/u);
  if (!match) return null;
  const speaker = match[1].replace(/[（(][^）)]*[）)]/g, '').replace(/\s*(?:O\.S\.|OS|VO)\s*$/i, '').trim();
  const text = match[2].replace(/^(?:[（(][^）)]*[）)]\s*)+/u, '');
  if (!speaker || !text) return null;
  return { speaker, text };
}

function isMetadata(line) {
  return /^\s*(?:第[\d一二三四五六七八九十百]+集(?:\s.*)?|\d+[-－]\d+\s.*|(?:INT|EXT|INT\/EXT)\..*|(?:人物|角色|场景|时间|地点)[：:].*)\s*$/iu.test(line);
}

function sourceEvents(lines) {
  const ledger = []; const kinds = [];
  let active; let blankLines = 0;
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) { kinds.push(null); blankLines++; continue; }
    const marker = line.trim().replace(/^△\s*/, '');
    let kind = isMetadata(line) ? 'metadata' : /^(?:制作要求|全局规则|拍摄要求)[：:]/.test(marker) ? 'global_directive' :
      /^(?:弹幕|字幕|屏幕文字)[：:]/.test(marker) ? 'screen_text' : /^(?:音效|环境音|声音)[：:]/.test(marker) ? 'sound' :
      /^(?:转场|切至|淡入|淡出)[：:]?/.test(marker) ? 'transition' : null;
    const dialogue = kind ? null : sourceDialogue(line);
    if (dialogue) { active = { ...dialogue }; ledger.push(active); kind = 'dialogue'; }
    else if (!kind && active && !/^\s*(?:△|【|\[)/.test(line)) { active.text += '\n'.repeat(blankLines + 1) + line; kind = 'dialogue'; }
    else { active = null; kind ||= 'action'; }
    kinds[index] = kind;
    blankLines = 0;
  }
  return { ledger, kinds };
}

function performedDialogue(prose, { strict = false } = {}) {
  const entries = [];
  const spans = [];
  // The last subject immediately preceding the speech clause owns the utterance.
  // Quotes in other fields must never be used as evidence of spoken performance.
  const pattern = /主体(\d+)((?:(?!主体)[^\n“”"]){0,45}?)(?:[：:]\s*)?[“"]([^”"]*)[”"]/g;
  for (const match of prose.matchAll(pattern)) {
    if (!/(?:说|喊|问|答|念|吼|呼|OS|O\.S\.|VO|画外|内心|电话|同步|[：:])/i.test(match[2])) continue;
    const delivery = /电话/.test(match[2]) ? 'phone' : /VO|内心/i.test(match[2]) ? 'voiceover' : /OS|O\.S\.|画外/i.test(match[2]) ? 'offscreen' : 'sync';
    entries.push({ subject: Number(match[1]), text: match[3], delivery, index: match.index });
    spans.push([match.index, match.index + match[0].length]);
  }
  for (const match of prose.matchAll(/(画外声音|电话声音|内心声音|现场齐声|线上弹幕)[（(]([^）)]+)[）)]\s*(?:说|喊|显示)?\s*[：:]\s*[“"]([^”"]*)[”"]/g)) {
    const delivery = { 画外声音: 'offscreen', 电话声音: 'phone', 内心声音: 'voiceover', 现场齐声: 'onsite_group', 线上弹幕: 'online_comment' }[match[1]];
    entries.push({ speaker: match[2], text: match[3], delivery, index: match.index });
    spans.push([match.index, match.index + match[0].length]);
  }
  let remainder = prose;
  for (const [start, end] of spans.sort((a, b) => b[0] - a[0])) remainder = remainder.slice(0, start) + ' '.repeat(end - start) + remainder.slice(end);
  if (!strict) remainder = remainder.replace(/(?:字幕|屏幕文字|标牌|标识)(?:显示|写着)?\s*[：:]?\s*(?:“[^”]*”|"[^"\n]*")/g, '');
  if (/主体\d+[^。；\n“”"]*(?:说|喊|问|答|念|吼)\s*(?:主体\d+|$)/.test(remainder.trim())) throw new Error('Unparsed dialogue owner; use one explicit speaker per utterance.');
  if (strict ? remainder.replace(/[\s；;，,。.!！、]/g, '').replace(/^无$/, '') : /(?:说|喊|问|答|念|吼|呼喊|O\.S\.|\bOS|\bVO|画外声音|电话声音|内心声音|现场齐声|线上弹幕)(?:道|着)?\s*(?:[（(][^）)]+[）)])?\s*[：:“"]/.test(remainder)) throw new Error('Unparsed dialogue/performance instruction; use explicit owner and quoted verbatim speech.');
  return entries.sort((a, b) => a.index - b.index);
}

module.exports = { sourceDialogue, sourceEvents, isMetadata, performedDialogue };

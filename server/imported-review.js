import { createHash, randomBytes } from 'node:crypto';
import { categoryFiles, loadQuestionBank } from './questions.js';
import { operationsSession, operationsTrustedOrigin, operationsJsonRequest } from './operations-access.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson } from './http.js';
import { redis, rateLimit } from './redis.js';
import { recordAuditEvent } from './audit.js';

export const questionRevision = q => createHash('sha256').update(JSON.stringify(q)).digest('hex');
export const importedReviewKey = (category, id) => `geek:import-review:${category}:${id}`;
const validText = (s, min, max) => typeof s === 'string' && s.trim().length >= min && s.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
export function correction(value) {
  if (!value || Array.isArray(value) || Object.keys(value).some(k => !['prompt', 'options', 'correctIndex', 'difficulty', 'source', 'funFact'].includes(k)) ||
      !validText(value.prompt, 12, 280) || !Array.isArray(value.options) || value.options.length !== 4 || !value.options.every(v => validText(v, 1, 180)) || new Set(value.options.map(v => v.trim().toLowerCase())).size !== 4 ||
      !Number.isInteger(value.correctIndex) || value.correctIndex < 0 || value.correctIndex > 3 || !['easy', 'medium', 'hard'].includes(value.difficulty) || !validText(value.funFact, 8, 1800)) throw new Error('INVALID_REQUEST');
  let url;
  try { url = new URL(value.source); } catch { throw new Error('INVALID_REQUEST'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.href.length > 500) throw new Error('INVALID_REQUEST');
  return { prompt: value.prompt.trim(), options: value.options.map(v => v.trim()), correctIndex: value.correctIndex, difficulty: value.difficulty, source: url.href, funFact: value.funFact.trim() };
}
export function validateReviewBatch(body, category, now = Date.now()) {
  if (!body || !['reviewed', 'correct', 'retire'].includes(body.decision) || body.sourceChecked !== true || !validText(body.note, 8, 500) ||
      !Array.isArray(body.items) || !body.items.length || body.items.length > 10 || (body.decision === 'correct' && body.items.length !== 1) ||
      Object.keys(body).some(k => !['category', 'decision', 'sourceChecked', 'note', 'items', 'correction'].includes(k))) throw new Error('INVALID_REQUEST');
  const seen = new Set(), bank = loadQuestionBank(category);
  return body.items.map(item => {
    if (!item || Object.keys(item).some(k => !['id', 'revision', 'reviewVersion'].includes(k)) || !validText(item.id, 1, 64) || seen.has(item.id) ||
        typeof item.reviewVersion !== 'string' || !/^(?:[a-f0-9]{24})?$/.test(item.reviewVersion)) throw new Error('INVALID_REQUEST');
    seen.add(item.id);
    const q = bank.questions.find(q => q.id === item.id);
    if (!q || questionRevision(q) !== item.revision) throw new Error('IMPORT_REVIEW_CHANGED');
    if (body.decision === 'reviewed') correction({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, difficulty: q.difficulty, source: q.source, funFact: q.funFact });
    return { schema: 1, category, id: q.id, questionRevision: item.revision, expectedVersion: item.reviewVersion, version: randomBytes(12).toString('hex'),
      decision: body.decision, checkedAt: new Date(now).toISOString(), note: body.note.trim(), sourceChecked: true,
      ...(body.decision === 'correct' ? { correction: correction(body.correction) } : {}) };
  });
}
export const reviewBatchScript = `
-- geek-import-review-v1: compare all selected rows before writing.
local proposals = cjson.decode(ARGV[1])
for i,key in ipairs(KEYS) do
  local old = redis.call('GET',key)
  local version = ''
  if old then
    local ok, record = pcall(cjson.decode,old)
    if not ok or type(record) ~= 'table' or type(record.version) ~= 'string' then return 'INVALID' end
    version = record.version
  end
  if version ~= proposals[i].expectedVersion then return 'CHANGED' end
end
for i,key in ipairs(KEYS) do redis.call('SET',key,cjson.encode(proposals[i]),'EX',7776000) end
return 'OK'`;

export async function importedReviewHandler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    const session = await operationsSession(req);
    if (!session) return sendJson(res, 401, { ok: false, error: 'Sign in to review imported questions.' });
    if (!session.permissions.includes('cce') || req.headers?.['sec-fetch-site'] === 'cross-site' ||
        ['authorization', 'x-cce-admin', 'x-audit-admin', 'x-payout-review-admin'].some(h => Object.hasOwn(req.headers || {}, h)) ||
        (req.headers?.origin && !operationsTrustedOrigin(req)) || (req.method === 'POST' && (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)))) {
      return sendJson(res, 403, { ok: false, error: 'Owner question-review access is required.' });
    }
    await rateLimit('import-review', clientFingerprint(req), 60, 600);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const category = req.method === 'POST' ? body.category : req.query?.category || 'technology';
    if (typeof category !== 'string' || !Object.hasOwn(categoryFiles, category)) throw new Error('INVALID_REQUEST');
    if (req.method === 'POST') {
      const proposals = validateReviewBatch(body, category);
      await recordAuditEvent({ type: 'questions.import-review.requested', actorType: 'owner-session', actorId: clientFingerprint(req), objectType: 'question-bank', objectId: category,
        outcome: 'success', reason: 'editorial-proposal', details: { count: proposals.length, decision: body.decision, published: false } });
      const outcome = await redis('EVAL', reviewBatchScript, proposals.length, ...proposals.map(p => importedReviewKey(category, p.id)), JSON.stringify(proposals));
      if (outcome === 'CHANGED') throw new Error('IMPORT_REVIEW_CHANGED');
      if (outcome !== 'OK') throw new Error('IMPORT_REVIEW_INVALID');
      return sendJson(res, 200, { ok: true, saved: proposals.length, published: false });
    }
    const offset = Number(req.query?.offset || 0), search = String(req.query?.search || '').trim().toLowerCase(), filter = req.query?.filter || 'draft';
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 20000 || search.length > 100 || !['draft', 'checked', 'all'].includes(filter)) throw new Error('INVALID_REQUEST');
    const pool = loadQuestionBank(category).questions.filter(q => (filter === 'all' || (q.reviewStatus === 'source-checked') === (filter === 'checked')) &&
      (!search || `${q.id} ${q.prompt} ${q.source}`.toLowerCase().includes(search)));
    const page = pool.slice(offset, offset + 10), records = page.length ? await redis('MGET', ...page.map(q => importedReviewKey(category, q.id))) : [];
    if (!Array.isArray(records) || records.length !== page.length) throw new Error('IMPORT_REVIEW_INVALID');
    const rows = page.map((q, i) => {
      let proposal = null;
      if (records[i]) {
        try { proposal = JSON.parse(records[i]); } catch { throw new Error('IMPORT_REVIEW_INVALID'); }
        if (!proposal || proposal.schema !== 1 || proposal.category !== category || proposal.id !== q.id || !/^[a-f0-9]{24}$/.test(proposal.version)) throw new Error('IMPORT_REVIEW_INVALID');
      }
      return { question: q, revision: questionRevision(q), proposal, staleProposal: Boolean(proposal && proposal.questionRevision !== questionRevision(q)) };
    });
    return sendJson(res, 200, { ok: true, category, categories: Object.keys(categoryFiles), offset, total: pool.length, rows, published: false });
  } catch (error) {
    if (error.message === 'IMPORT_REVIEW_CHANGED') return sendJson(res, 409, { ok: false, error: 'The source or review changed. Refresh before deciding again.' });
    if (error.message === 'IMPORT_REVIEW_INVALID') return sendJson(res, 503, { ok: false, error: 'Review storage is unavailable. Existing records are preserved.' });
    return handleApiError(res, error);
  }
}

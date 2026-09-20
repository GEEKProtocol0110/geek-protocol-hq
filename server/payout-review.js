import { randomBytes, timingSafeEqual } from 'node:crypto';
import { auditWriteCommands, createAuditRecord, hashAuditIdentifier } from './audit.js';
import { loadProfile } from './profile.js';
import { parseStoredJson, pipeline, redis } from './redis.js';

const REVIEW_PREFIX = 'geek:payout-review:';
const REVIEW_QUEUE = 'geek:payout-review:index';
const REVIEW_ID = /^pvr_[a-f0-9]{24}$/;

const reviewKey = (id) => `${REVIEW_PREFIX}${id}`;
const cleanNote = (value) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

export const loadPayoutReview = async (id) => {
  if (!REVIEW_ID.test(String(id || ''))) return null;
  return parseStoredJson(await redis('GET', reviewKey(id)));
};

export const payoutReviewView = (record) => record ? ({
  id: record.id,
  status: record.status,
  reasons: Array.isArray(record.reasons) ? record.reasons : [],
  addressMasked: record.addressMasked || '',
  payoutVersion: Number(record.payoutVersion || 0),
  createdAt: Number(record.createdAt || 0),
  resolvedAt: Number(record.resolvedAt || 0),
  decisionNote: record.decisionNote || '',
  settlementEnabled: false
}) : null;

export const createPayoutReview = ({ playerId, address, addressMasked, payoutVersion, reasons, now = Date.now() }) => ({
  id: `pvr_${randomBytes(12).toString('hex')}`,
  playerId,
  status: 'pending',
  reasons: [...new Set(reasons)].slice(0, 8),
  addressHash: hashAuditIdentifier(address),
  addressMasked,
  payoutVersion: Number(payoutVersion || 0),
  createdAt: now,
  resolvedAt: 0,
  decisionNote: '',
  settlementEnabled: false
});

export const payoutReviewWriteCommands = (record, previousRecord = null) => {
  const commands = [];
  if (previousRecord?.status === 'pending') {
    const superseded = { ...previousRecord, status: 'superseded', resolvedAt: Date.now(), decisionNote: 'Replaced by a newer payout setting.' };
    commands.push(['SET', reviewKey(previousRecord.id), JSON.stringify(superseded)]);
    commands.push(['ZREM', REVIEW_QUEUE, previousRecord.id]);
  }
  if (record) {
    commands.push(['SET', reviewKey(record.id), JSON.stringify(record), 'NX']);
    commands.push(['ZADD', REVIEW_QUEUE, record.createdAt, record.id]);
  }
  return commands;
};

const providedReviewerToken = (req) => {
  const explicit = String(req.headers?.['x-payout-review-admin'] || '');
  const authorization = String(req.headers?.authorization || '');
  return explicit || (authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
};

export const requirePayoutReviewer = (req) => {
  const expected = String(process.env.PAYOUT_REVIEW_ADMIN_TOKEN || '');
  const provided = providedReviewerToken(req);
  if (expected.length < 24) throw new Error('PAYOUT_REVIEW_NOT_CONFIGURED');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) throw new Error('PAYOUT_REVIEW_FORBIDDEN');
};

export const listPayoutReviews = async () => {
  const ids = await redis('ZREVRANGE', REVIEW_QUEUE, 0, 99);
  const stored = ids.length ? await pipeline(ids.map((id) => ['GET', reviewKey(id)])) : [];
  return stored.map(parseStoredJson).filter((item) => item?.status === 'pending').map(payoutReviewView);
};

export const decidePayoutReview = async (body, context = {}) => {
  const id = String(body.id || '');
  const action = String(body.action || '');
  const note = cleanNote(body.note);
  if (!REVIEW_ID.test(id)) throw new Error('PAYOUT_REVIEW_NOT_FOUND');
  if (!['approve', 'reject'].includes(action) || note.length < 8) throw new Error('PAYOUT_REVIEW_NOTE_REQUIRED');
  const record = await loadPayoutReview(id);
  if (!record) throw new Error('PAYOUT_REVIEW_NOT_FOUND');
  if (record.status !== 'pending') throw new Error('PAYOUT_REVIEW_STATE_INVALID');

  const profile = await loadProfile(record.playerId);
  const currentAddressHash = profile.payoutAddress ? hashAuditIdentifier(profile.payoutAddress) : '';
  const current = profile.payoutReviewId === id
    && Number(profile.payoutAddressVersion || 0) === Number(record.payoutVersion || 0)
    && currentAddressHash === record.addressHash;
  const now = Date.now();
  const nextStatus = current ? (action === 'approve' ? 'approved' : 'rejected') : 'superseded';
  const updated = {
    ...record,
    status: nextStatus,
    resolvedAt: now,
    decisionNote: current ? note : 'Payout setting changed before review completed.'
  };
  const audit = await createAuditRecord({
    type: `payout.review.${nextStatus}`,
    severity: 'warning',
    actorType: 'payout-reviewer',
    actorId: context.actorId || 'payout-reviewer',
    objectType: 'payout-review',
    objectId: id,
    outcome: current ? 'success' : 'deferred',
    reason: current ? 'manual-risk-decision' : 'stale-review',
    interactionId: context.interactionId || id,
    details: {
      action,
      payoutVersion: record.payoutVersion,
      reasons: record.reasons,
      settlementEnabled: false
    }
  });
  await pipeline([
    ['SET', reviewKey(id), JSON.stringify(updated)],
    ['ZREM', REVIEW_QUEUE, id],
    ...auditWriteCommands(audit)
  ], true);
  return { review: payoutReviewView(updated), audit };
};

import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { redisFixture } from './helpers/redis-fixture.js';
import handler from '../api/session.js';
import { communityPrefix } from '../server/community-contributions.js';
import { verifyAuditRecord } from '../server/audit.js';
import { isValidKaspaMainnetAddress } from '../server/kaspa-address.js';
import { applicationClient, communityLink } from '../public/thanks/assets/community-core.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
const origin = 'https://www.geekprotocol.xyz', owner = 'synthetic-community-owner-key-with-32-characters';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.community.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-community-fixture';
let loseReply = '';
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/redis\.community\.test/);
  const args = JSON.parse(options.body); let payload;
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...args, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(args)).map(result => ({ result }));
  else {
    payload = { result: await fixture.command(...args) };
    if (loseReply && args[0] === 'EVAL' && String(args[1]).includes(loseReply)) { loseReply = ''; throw new Error('Synthetic lost community response'); }
  }
  return new Response(JSON.stringify(payload));
};
beforeEach(async () => { await fixture.command('FLUSHDB'); loseReply = ''; process.env.OPS_ACCESS_TOKEN = owner; process.env.CCE_ADMIN_TOKEN = 'synthetic-community-cce-key-with-24-characters'; process.env.AUDIT_LOG_SECRET = 'synthetic-community-audit-secret-with-32-characters'; process.env.VERCEL_ENV = 'production'; delete process.env.OPS_TOTP_SECRET; });
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; }, end(v) { this.body = v; return this; } });
const call = async ({ method = 'GET', service = 'community', action = '', cookie = '', body, query = {}, headers = {} } = {}) => {
  const res = response(); await handler({ method, query: { service, action, ...query }, headers: { origin, cookie, 'content-type': 'application/json', 'user-agent': 'community-test', 'x-forwarded-for': '192.0.2.10', ...headers }, body }, res); return res;
};
const application = (extra = {}) => ({ requestId: randomUUID(), name: 'Example Geek', profile: 'https://example.com/geek', kind: 'testing', details: 'I tested the game and reported a reproducible bug.', evidence: 'https://example.com/public-evidence', recognition: true, consent: true, website: '', ...extra });
const apply = body => call({ method: 'POST', body });
const login = async () => { const result = await call({ service: 'operations', action: 'login', method: 'POST', body: { key: owner } }); assert.equal(result.statusCode, 200); return result.headers['Set-Cookie'].split(';')[0]; };
const review = (cookie, body, extra = {}) => call({ service: 'operations', action: 'community', cookie, method: 'POST', body, ...extra });
const list = (cookie, view = 'pending') => call({ service: 'operations', action: 'community', cookie, query: { view } });
const publish = id => ({ id, expectedRevision: 1, action: 'publish', note: 'Checked the submitted evidence.', summary: 'Helped test Geek and report a reproducible bug.', confirmed: true });

test('applications are private, public writes cannot publish, and exact retries have one durable receipt', async () => {
  const body = application();
  const replies = await Promise.all([apply(body), apply(body)]);
  assert.ok(replies.every(r => r.statusCode === 200)); assert.equal(replies[0].body.receipt.id, replies[1].body.receipt.id);
  const id = replies[0].body.receipt.id;
  assert.equal(await fixture.command('ZCARD', communityPrefix() + ':pending'), 1);
  assert.equal(await fixture.command('ZCARD', 'geek:audit:index'), 1);
  assert.deepEqual((await call()).body.credits, []);
  assert.equal(JSON.stringify(replies[0].body).includes(body.details), false);
  assert.equal((await apply({ ...body, details: 'A different contribution should be a new application.' })).statusCode, 409);
  assert.equal((await apply({ ...body, status: 'published', donationVerified: true })).statusCode, 400);
  assert.equal((await call({ query: { id } })).body.credits.length, 0);
});

test('consent, bounded bodies, HTTPS links, honeypot and origin restrictions reject unsafe submissions', async () => {
  for (const extra of [{ consent: false }, { website: 'bot.example' }, { profile: 'javascript:alert(1)' }, { evidence: 'https://user:pass@example.com/' }, { name: '<img onerror=evil>' }, { details: 'x'.repeat(1201) }, { recognition: 'yes' }, { kind: 'sponsor-ranking' }]) assert.equal((await apply(application(extra))).statusCode, 400);
  for (const body of ['null', '7', '[]', { padding: 'x'.repeat(8001) }]) assert.equal((await apply(body)).statusCode, 400);
  for (const headers of [{ origin: 'https://evil.example' }, { origin: '' }, { 'content-type': 'text/plain' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await call({ method: 'POST', body: application(), headers })).statusCode, 403);
  assert.equal(await fixture.command('ZCARD', communityPrefix() + ':pending'), 0);
});

test('guest and role keys cannot read or decide owner reviews; stale and rotated owner sessions fail closed', async () => {
  const { id } = (await apply(application())).body.receipt;
  for (const cookie of ['', 'geek_session=' + 'a'.repeat(32)]) {
    assert.equal((await list(cookie)).statusCode, 401); assert.equal((await review(cookie, publish(id))).statusCode, 401);
  }
  assert.equal((await call({ service: 'operations', action: 'community', headers: { 'x-cce-admin': process.env.CCE_ADMIN_TOKEN } })).statusCode, 401);
  assert.equal((await call({ service: 'operations', query: { path: 'community' } })).statusCode, 303);
  assert.equal((await call({ service: 'operations', query: { path: 'assets/community.js' } })).statusCode, 401);
  const cookie = await login(); assert.equal((await list(cookie)).body.items.length, 1);
  for (const headers of [{ origin: 'https://evil.example' }, { origin: '' }, { 'content-type': 'text/plain' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await review(cookie, publish(id), { headers })).statusCode, 403);
  process.env.OPS_ACCESS_TOKEN += '-rotated'; assert.equal((await list(cookie)).statusCode, 401);
  assert.deepEqual((await call()).body.credits, []);
});

test('only a confirmed owner decision publishes allowlisted public fields and valid audit evidence', async () => {
  const body = application({ details: 'PRIVATE application context that must never be public.' });
  const id = (await apply(body)).body.receipt.id, cookie = await login();
  assert.equal((await review(cookie, { ...publish(id), confirmed: false })).statusCode, 400);
  assert.equal((await review(cookie, { ...publish(id), summary: '<script>private</script>' })).statusCode, 400);
  const decisions = await Promise.all([review(cookie, publish(id)), review(cookie, { ...publish(id), action: 'close' })]);
  assert.deepEqual(decisions.map(r => r.statusCode).sort(), [200, 409]);
  const credits = (await call()).body.credits;
  if (decisions[0].statusCode === 200) {
    assert.equal(credits.length, 1); assert.deepEqual(Object.keys(credits[0]).sort(), ['id', 'kind', 'name', 'profile', 'publishedAt', 'revision', 'summary']);
    assert.equal(JSON.stringify(credits).includes(body.details), false); assert.equal(JSON.stringify(credits).includes(body.evidence), false);
  } else assert.equal(credits.length, 0);
  const ids = await fixture.command('ZREVRANGE', 'geek:audit:index', 0, -1);
  const events = await Promise.all(ids.map(id => fixture.command('GET', 'geek:audit:event:' + id)));
  assert.ok(events.map(JSON.parse).every(verifyAuditRecord));
  assert.equal(events.filter(raw => raw.includes('community.credit.published') || raw.includes('community.application.closed')).length, 1);
  assert.equal(events.some(raw => raw.includes(body.details) || raw.includes(body.profile)), false);
});

test('offers without public consent can be closed but cannot be published; withdrawal removes only reviewed public credit', async () => {
  const offered = (await apply(application({ recognition: false, consent: false }))).body.receipt.id;
  const requested = (await apply(application())).body.receipt.id, cookie = await login();
  assert.equal((await review(cookie, publish(offered))).statusCode, 400);
  assert.equal((await review(cookie, { ...publish(offered), action: 'close' })).statusCode, 200);
  assert.ok(Number(await fixture.command('TTL', communityPrefix() + ':application:' + offered)) <= 30 * 86400);
  assert.equal((await review(cookie, publish(requested))).statusCode, 200);
  assert.equal((await call()).body.credits.length, 1);
  assert.equal((await review(cookie, { ...publish(requested), action: 'withdraw' })).statusCode, 200);
  assert.deepEqual((await call()).body.credits, []);
  assert.equal((await review(cookie, { ...publish(requested), action: 'withdraw' })).statusCode, 409);
});

test('storage faults leave no partial public credit; lost submission and publication responses can be recovered', async () => {
  const body = application(); loseReply = 'geek-community-create-v1';
  assert.equal((await apply(body)).statusCode, 500);
  const id = (await apply(body)).body.receipt.id; assert.equal(await fixture.command('ZCARD', communityPrefix() + ':pending'), 1);
  const cookie = await login(); await fixture.command('SET', communityPrefix() + ':credits', 'wrong-type');
  assert.equal((await review(cookie, publish(id))).statusCode, 503);
  assert.equal(await fixture.command('EXISTS', communityPrefix() + ':credit:' + id), 0);
  assert.equal((await list(cookie)).body.items.length, 1);
  await fixture.command('DEL', communityPrefix() + ':credits'); loseReply = 'geek-community-decide-v1';
  assert.equal((await review(cookie, publish(id))).statusCode, 500);
  assert.equal((await list(cookie)).body.items.length, 0); assert.equal((await list(cookie, 'published')).body.items.length, 1);
  assert.equal((await review(cookie, publish(id))).statusCode, 409);
  assert.equal((await call()).body.credits.length, 1);
});

test('visitor rate limits and retention bound the pending queue without blocking an exact receipt retry', async () => {
  const body = application(); const id = (await apply(body)).body.receipt.id;
  await apply(application()); await apply(application());
  assert.equal((await apply(application())).statusCode, 429);
  assert.equal((await apply(body)).body.receipt.id, id);
  assert.ok(Number(await fixture.command('TTL', communityPrefix() + ':application:' + id)) <= 90 * 86400);
  await fixture.command('ZADD', communityPrefix() + ':pending', Date.now() - 91 * 86400 * 1000, 'app_' + 'b'.repeat(32));
  await list(await login()); assert.equal(await fixture.command('ZSCORE', communityPrefix() + ':pending', 'app_' + 'b'.repeat(32)), null);
});

test('queue and public-credit capacity fail without losing applications or publishing partial credits', async () => {
  const prefix = communityPrefix(), now = Date.now();
  for (let i = 0; i < 500; i++) await fixture.command('ZADD', prefix + ':pending', now, 'app_' + i.toString(16).padStart(32, '0'));
  assert.equal((await apply(application())).statusCode, 503);
  assert.equal((await fixture.command('KEYS', prefix + ':application:*')).length, 0);
  assert.equal(await fixture.command('ZCARD', 'geek:audit:index'), 0);
  await fixture.command('DEL', prefix + ':pending');
  const id = (await apply(application())).body.receipt.id, cookie = await login();
  for (let i = 0; i < 200; i++) await fixture.command('ZADD', prefix + ':credits', now, 'app_' + i.toString(16).padStart(32, '0'));
  const auditCount = await fixture.command('ZCARD', 'geek:audit:index');
  assert.equal((await review(cookie, publish(id))).statusCode, 503);
  assert.equal(await fixture.command('EXISTS', prefix + ':credit:' + id), 0);
  assert.equal((await list(cookie)).body.items[0].id, id);
  assert.equal(await fixture.command('ZCARD', 'geek:audit:index'), auditCount);
});

test('public pagination stays bounded and credits remain withdrawable after private applications expire', async () => {
  const prefix = communityPrefix(), cookie = await login();
  const id = (await apply(application())).body.receipt.id;
  assert.equal((await review(cookie, publish(id))).statusCode, 200);
  await fixture.command('DEL', prefix + ':application:' + id);
  assert.equal((await call()).body.credits[0].id, id);
  assert.equal((await review(cookie, { ...publish(id), action: 'withdraw' })).statusCode, 200);
  assert.deepEqual((await call()).body.credits, []);
  for (let i = 0; i < 21; i++) {
    const creditId = 'app_' + i.toString(16).padStart(32, '0');
    await fixture.command('SET', prefix + ':credit:' + creditId, JSON.stringify({ version: 1, id: creditId, revision: 1, name: 'Example Geek', profile: '', kind: 'testing', summary: 'Contributed useful testing feedback.', publishedAt: 1000 + i, details: 'PRIVATE fixture field' }));
    await fixture.command('ZADD', prefix + ':credits', 1000 + i, creditId);
  }
  const first = (await call()).body, second = (await call({ query: { offset: '20' } })).body;
  assert.equal(first.credits.length, 20); assert.equal(first.hasMore, true);
  assert.equal(second.credits.length, 1); assert.equal(second.hasMore, false);
  assert.equal(new Set([...first.credits, ...second.credits].map(row => row.id)).size, 21);
  assert.equal(JSON.stringify(first).includes('PRIVATE fixture field'), false);
  for (const offset of ['-1', '501', '0junk']) assert.equal((await call({ query: { offset } })).statusCode, 400);
});

test('receipt retries reuse the original payload after a lost reply and public profile links reject active schemes', async () => {
  const payloads = []; let attempt = 0;
  const client = applicationClient(async (_url, options) => { payloads.push(JSON.parse(options.body)); if (!attempt++) throw new Error('Lost reply'); return new Response(JSON.stringify({ ok: true, receipt: { id: 'app_' + 'a'.repeat(32) } })); });
  await assert.rejects(client.submit({ name: 'First' }), /Lost reply/); assert.equal(client.pending, true);
  await client.submit({ name: 'Edited' }); assert.deepEqual(payloads[0], payloads[1]); assert.equal(client.pending, false);
  assert.equal(communityLink('javascript:alert(1)'), ''); assert.equal(communityLink('https://user:pass@example.com/'), ''); assert.equal(communityLink('https://example.com/geek'), 'https://example.com/geek');
});

test('the designated fund address is valid and the page keeps wallet signing outside the application flow', () => {
  const html = readFileSync('public/thanks/index.html', 'utf8');
  const address = html.match(/data-fund-address>(kaspa:[a-z0-9]+)<\/textarea>/)[1];
  assert.equal(address, 'kaspa:qpfrn9je94gy0d4j0ymy920a7sgyndel6jtxfzra4w72cxafd0lpwq0k9nvfr'); assert.equal(isValidKaspaMainnetAddress(address), true);
  const code = readFileSync('public/thanks/assets/community.js', 'utf8');
  assert.doesNotMatch(code, /signMessage|sendKaspa|signTransaction|requestAccounts|innerHTML/);
});

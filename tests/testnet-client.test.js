import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownerClient, escapeHtml, formatTokenUnits } from '../server/ops-ui/assets/ops-core.js';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../server/ops-ui/assets/testnet.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
const settle = () => new Promise(setImmediate);
const run = { id: 'a'.repeat(40), status: 'finished', mode: 'daily', category: 'kaspa', completedRound: 1, questionCount: 5, questionIndex: 4, correct: 3 };
const receipt = { id: 'b'.repeat(64), state: 'queued', ticker: 'GEEKT', amount: '100000000', decimals: '8', network: 'testnet-10', recipient: 'synthetic-recipient', proof: { correct: 3, score: 100 } };
const windowPayload = (patch = {}) => ({ ok: true, enabled: true, state: 'eligible', playerName: 'Proof Geek', run: { id: run.id, correct: 3, score: 100, remainingMs: 250000 }, ...patch });
const runEndpoint = '/api/session?service=operations&action=testnet&run=latest';
const setup = async (reply = () => json(windowPayload())) => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (url === runEndpoint) return reply(options);
    if (options.method === 'POST') return json({ ok: true, record: receipt });
    return json({ ok: true, enabled: true, network: 'testnet-10', config: { ticker: 'GEEKT', amount: '100000000', decimals: '8' }, records: [receipt] });
  };
  const ui = clientFixture(fetchImpl, { ownerClient: args => ownerClient({ ...args, fetchImpl }), escapeHtml, formatTokenUnits });
  const form = ui.node('[data-queue]');
  form.elements = { runId: ui.make('input'), recipient: ui.make('input') };
  ui.run(source); await settle();
  return { ...ui, requests, form };
};

test('the pilot loads the owned finished Daily without copying JSON or creating a receipt', async () => {
  const ui = await setup();
  assert.equal(ui.form.elements.runId.value, run.id);
  assert.match(ui.node('[data-run-status]').textContent, /3 \/ 5 correct/);
  assert.ok(ui.requests.every(r => r.options.method === 'GET'));
  const resume = ui.requests.find(r => r.url === runEndpoint);
  assert.equal(resume.options.credentials, 'same-origin'); assert.equal(resume.options.cache, 'no-store');
  ui.form.elements.recipient.value = 'synthetic-recipient';
  await ui.form.emit('submit'); await settle();
  const writes = ui.requests.filter(r => r.options.method === 'POST');
  assert.equal(writes.length, 1);
  assert.deepEqual(JSON.parse(writes[0].options.body), { action: 'queue', runId: run.id, recipient: 'synthetic-recipient' });
});

test('wallet amounts preserve large integer precision and reject unknown or malformed decimals', async () => {
  assert.equal(formatTokenUnits('100000000','8'),'1');
  assert.equal(formatTokenUnits('14400000000000000000','8'),'144000000000');
  assert.equal(formatTokenUnits('9007199254740993','8'),'90071992.54740993');
  assert.equal(formatTokenUnits('1','18'),'0.000000000000000001');
  assert.equal(formatTokenUnits('1','0'),'1');
  for(const [raw,dec] of [['01','8'],['1.5','8'],['1','08'],['1','19'],['1',undefined],[9007199254740993,'8']]) assert.equal(formatTokenUnits(raw,dec),null);
  const ui=await setup();
  assert.match(ui.node('[data-config]').textContent,/1 GEEKT \(100000000 base units; 8 decimals\)/);
  assert.match(ui.node('[data-records]').innerHTML,/queued receipt has not sent any tokens/);
  assert.ok(ui.requests.every(r=>r.options.method==='GET'));
});

test('selected transfer fields distinguish whole tokens from raw units and clear with private records', async () => {
  const ui = await setup();
  assert.equal(ui.node('[data-transfer-review]').hidden, true);
  const select = ui.make('button'); select.dataset.select = receipt.id;
  await ui.node('[data-records]').emit('click', { target: select });
  assert.equal(ui.node('[data-transfer-amount]').value, '1 GEEKT');
  assert.equal(ui.node('[data-transfer-recipient]').value, receipt.recipient);
  assert.deepEqual(JSON.parse(ui.node('[data-transfer-json]').value), { p:'krc-20',op:'transfer',tick:'GEEKT',amt:'100000000',to:receipt.recipient });
  assert.match(ui.node('[data-transfer-note]').textContent, /Queued instructions only/);
  ui.window.dispatchEvent(new Event('pagehide'));
  assert.equal(ui.node('[data-transfer-review]').hidden, true);
  assert.equal(ui.node('[data-transfer-json]').value, ''); assert.equal(ui.node('[data-transfer-recipient]').value, '');
  assert.ok(ui.requests.every(r => r.options.method === 'GET'), 'review does not send a transfer or create a receipt');
});

test('an expired run clears the old ID and explains recovery without disabling existing receipts', async () => {
  let expired = false;
  const ui = await setup(() => expired ? json(windowPayload({ state: 'missing', run: null })) : json(windowPayload()));
  expired = true;
  await ui.node('[data-load-run]').emit('click'); await settle();
  assert.equal(ui.form.elements.runId.value, '');
  assert.match(ui.node('[data-run-status]').textContent, /expired run cannot be recovered/);
  assert.match(ui.node('[data-run-status]').textContent, /00:00 UTC/);
  assert.equal(ui.node('[data-load-run]').disabled, false);
  assert.match(ui.node('[data-records]').innerHTML, /queued/);
  assert.ok(ui.requests.every(r => r.options.method === 'GET'));
});

test('ineligible, disabled and malformed eligibility never enable queuing', async () => {
  for (const patch of [{state:'ineligible',run:null}, {state:'disabled',run:null},
    {run:{id:'<script>',correct:3,remainingMs:10000}}, {run:{id:run.id,correct:0,remainingMs:10000}},
    {run:{id:run.id,correct:3,remainingMs:300001}}, {run:{id:run.id,correct:3,remainingMs:'10000'}}]) {
    const ui = await setup(() => json(windowPayload(patch)));
    assert.equal(ui.form.elements.runId.value, '');
    assert.equal(ui.node('[data-queue-button]').disabled, true);
    assert.ok(ui.requests.every(r => r.options.method === 'GET'));
  }
});

test('player authentication errors are distinguished from owner access and late replies cannot restore a cleared ID', async () => {
  const denied = await setup(() => json({ ok: false }, 401));
  assert.match(denied.node('[data-run-status]').textContent, /player session is separate from owner access/);
  const pending = deferred();
  const ui = await setup(() => pending.promise);
  await ui.node('[data-load-run]').emit('click');
  assert.equal(ui.requests.filter(r => r.url === runEndpoint).length, 1);
  const signal = ui.requests.at(-1).options.signal;
  await ui.window.emit('pagehide'); assert.equal(signal.aborted, true);
  pending.resolve(json(windowPayload())); await settle();
  assert.equal(ui.form.elements.runId.value, '');
  assert.equal(ui.node('[data-run-status]').textContent, '');
  assert.ok(ui.requests.every(r => r.options.method === 'GET'));
});


test('countdown subtracts request time, expires locally and never queues on return', async () => {
  const ui = await setup();
  assert.match(ui.node('[data-run-window]').textContent, /4:10/);
  assert.equal(ui.node('[data-queue-button]').disabled, false);
  await ui.window.emit('focus'); await settle();
  assert.equal(ui.requests.filter(r => r.url === runEndpoint).length, 2);
  assert.ok(ui.requests.every(r => r.options.method === 'GET'));
  ui.context.performance.now = () => 300100;
  ui.expire(1000);
  assert.equal(ui.form.elements.runId.value, '');
  assert.equal(ui.node('[data-queue-button]').disabled, true);
  assert.match(ui.node('[data-run-status]').textContent, /window has expired/);
  await ui.form.emit('submit'); await settle();
  assert.ok(ui.requests.every(r => r.options.method === 'GET'));
});

test('a back-forward-cache return reloads private records and eligibility after clearing them', async () => {
  const ui = await setup();
  await ui.window.emit('pagehide');
  assert.equal(ui.form.elements.runId.value, '');
  assert.equal(ui.node('[data-queue-button]').disabled, true);
  await ui.window.emit('pageshow', {persisted:true}); await settle();
  assert.equal(ui.form.elements.runId.value, run.id);
  assert.equal(ui.node('[data-queue-button]').disabled, false);
  assert.equal(ui.requests.filter(r => r.url === runEndpoint).length, 2);
  assert.ok(ui.requests.every(r => r.options.method === 'GET'));
});

test('a response slower than its remaining window stays expired instead of restarting five minutes', async () => {
  let ui, resolve;
  const pending = new Promise(done => { resolve = done; });
  ui = await setup(() => pending);
  ui.context.performance.now = () => 20100;
  resolve(json(windowPayload({run:{id:run.id,correct:3,remainingMs:10000}}))); await settle();
  assert.equal(ui.form.elements.runId.value, '');
  assert.equal(ui.node('[data-queue-button]').disabled, true);
  assert.match(ui.node('[data-run-status]').textContent, /expired/);
});

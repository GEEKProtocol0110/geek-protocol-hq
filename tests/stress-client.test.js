import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownerClient, escapeHtml } from '../server/ops-ui/assets/ops-core.js';
import { formatRaw } from '../public/economy/assets/amounts.js';
import { defaultStressScenario, parseStressScenario, stressExamples } from '../server/economy-stress.js';
import { clientFixture, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../server/ops-ui/assets/stress.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/gm, '');
const settle = () => new Promise(setImmediate);
test('the shipped stress form sends decimal strings, shows only modeled values and clears failed or abandoned results', async () => {
  let fail = false; const requests = [];
  const fetchImpl = async (_url, options) => { requests.push(options); return fail ? json({ ok: false }, 503) : options.method === 'POST' ? json({ ok: true, result: parseStressScenario(JSON.parse(options.body)) }) : json({ ok: true, examples: stressExamples() }); };
  const fixture = clientFixture(fetchImpl, { ownerClient: options => ownerClient({ ...options, fetchImpl }), e: escapeHtml, formatRaw });
  const fields = { ...defaultStressScenario(), ...defaultStressScenario().reserve, pattern: defaultStressScenario().correctByRound.join(',') };
  const form = fixture.node('[data-scenario]'); for (const [name, value] of Object.entries(fields)) { const input = fixture.make('input'); input.value = String(value); form.elements[name] = input; }
  fixture.run(source); await settle();
  await form.emit('submit'); await settle(); assert.match(fixture.node('[data-results]').innerHTML, /1,000 proposed claims covered/, fixture.node('[data-message]').textContent); assert.match(fixture.node('[data-results]').innerHTML, /No funds or credits changed/); assert.match(fixture.node('[data-results]').innerHTML, /10,000 full-budget days/); assert.match(fixture.node('[data-results]').innerHTML, /27.40 years/);
  const request = requests.find(r => r.method === 'POST'), body = JSON.parse(request.body); assert.equal(body.reserve.feeEach, '1'); assert.equal(request.credentials, 'same-origin'); assert.equal(body.transfersEnabled, undefined);
  fail = true; await form.emit('submit'); await settle(); assert.equal(fixture.node('[data-results]').innerHTML, '');
  await fixture.window.emit('pagehide'); assert.equal(fixture.node('[data-examples]').innerHTML, '');
});

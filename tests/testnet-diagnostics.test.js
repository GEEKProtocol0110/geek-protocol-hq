import test from 'node:test';
import assert from 'node:assert/strict';
import { reportFailure, reportOutcome, reportJournalState } from '../workers/testnet/diagnostics.mjs';

test('diagnostics emit only fixed stage/reason categories and never copy raw upstream data', () => {
  const events = [], report = event => events.push(event);
  const secret = `Bearer ${'a'.repeat(64)} kaspatest:private-recipient signed-transaction`;
  for (const error of [new Error(secret), secret, { message: secret, stack: secret, cause: secret, httpStatus: secret }]) reportFailure(secret, error, report);
  for (const event of events) assert.deepEqual(event, { event: 'tn10-worker-failure', stage: 'scheduled-run', code: 'UNCLASSIFIED' });
  assert.doesNotMatch(JSON.stringify(events), /Bearer|kaspatest|signed-transaction|aaaa/);
  reportFailure('claim', Object.assign(new Error('HQ_REQUEST_FAILED'), { httpStatus: 503 }), report);
  assert.deepEqual(events.at(-1), { event: 'tn10-worker-failure', stage: 'claim', code: 'HQ_REQUEST_FAILED', httpStatus: 503 });
  reportFailure('claim', Object.assign(new Error('HQ_REQUEST_FAILED'), { httpStatus: 200 }), report);
  assert.equal(Object.hasOwn(events.at(-1), 'httpStatus'), false);
});

test('common RPC rejection and timeout categories stay useful without transaction identifiers', () => {
  const cases = [
    ['RPC_TIMEOUT', 'RPC_TIMEOUT'], ['connection failed with private-host', 'RPC_CONNECTION_FAILED'],
    ['transaction deadbeef already accepted', 'RPC_ALREADY_KNOWN'], ['already in mempool: private-transaction', 'RPC_ALREADY_KNOWN'],
    ['script execution failed for private-transaction', 'RPC_SCRIPT_REJECTED'],
    ['orphan transaction private-transaction', 'RPC_INPUT_UNAVAILABLE'],
    ['request timed out for private-host', 'REQUEST_TIMEOUT']
  ];
  for (const [message, expected] of cases) {
    let event; reportFailure('submit-reveal', new Error(message), value => { event = value; });
    assert.equal(event.code, expected); assert.doesNotMatch(JSON.stringify(event), /private-|deadbeef/);
  }
});

test('result summaries cannot leak arbitrary states and broken logging cannot alter control flow', () => {
  const events = []; reportOutcome('reconciling', event => events.push(event));
  reportOutcome('private-recipient-and-key', event => events.push(event));
  assert.deepEqual(events, [{ event: 'tn10-worker-result', state: 'reconciling' }, { event: 'tn10-worker-result', state: 'unknown' }]);
  assert.doesNotThrow(() => reportOutcome('idle', () => { throw new Error('logger failed'); }));
  assert.doesNotThrow(() => reportFailure('verify', new Error('RPC_TIMEOUT'), () => { throw new Error('logger failed'); }));
  reportJournalState({ commitInputsAvailable: false, revealInputAvailable: true, recipient: 'private', hash: 'private' }, event => events.push(event));
  assert.deepEqual(events.at(-1), { event: 'tn10-worker-inputs', commitInputsAvailable: false, revealInputAvailable: true });
  reportJournalState({ commitInputsAvailable: 'private', revealInputAvailable: true }, () => assert.fail('Reject arbitrary values'));
});

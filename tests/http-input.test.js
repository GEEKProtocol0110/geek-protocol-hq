import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBody, readSessionId } from '../server/http.js';

test('malformed cookie encoding cannot interrupt session lookup', () => {
  const id = 'a'.repeat(32);
  assert.equal(readSessionId({ headers: { cookie: `other=%ZZ; geek_session=${id}` } }), id);
  assert.equal(readSessionId({ headers: { cookie: 'geek_session=%ZZ' } }), '');
});

test('the JSON body limit also applies after the platform parses the request', () => {
  assert.deepEqual(parseBody({ body: { action: 'play' } }), { action: 'play' });
  assert.throws(() => parseBody({ body: { text: 'x'.repeat(9_000) } }), /INVALID_BODY/);
  assert.throws(() => parseBody({ body: ['action'] }), /INVALID_BODY/);
});

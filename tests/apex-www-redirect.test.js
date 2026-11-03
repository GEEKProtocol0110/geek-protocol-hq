import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
const site = JSON.parse(readFileSync('docs/site-pages.json', 'utf8'));

test('apex host 308-redirects to the canonical www host with the path kept and no loop', () => {
  const apex = cfg.redirects.filter(r => r.has?.some(h => h.type === 'host' && h.value === 'geekprotocol.xyz'));
  assert.equal(apex.length, 2);
  const [home, rule] = apex;
  assert.equal(cfg.redirects[0], home, 'explicit homepage redirect runs first');
  assert.equal(cfg.redirects[1], rule, 'wildcard follows homepage before path redirects');
  assert.equal(home.source, '/');
  assert.equal(home.destination, `${site.origin}/`);
  assert.equal(home.permanent, true);
  assert.equal(home.statusCode, undefined);
  assert.deepEqual(home.has, [{ type: 'host', value: 'geekprotocol.xyz' }]);
  assert.equal(rule.permanent, true); // Vercel sends 308 for permanent redirects
  assert.equal(rule.statusCode, undefined);
  assert.equal(rule.source, '/:path*');
  assert.equal(rule.destination, `${site.origin}/:path*`);
  assert.equal(new URL(site.origin).host, 'www.geekprotocol.xyz');
  // The rule only matches the apex host, so www requests are never redirected again.
  assert.ok(!cfg.redirects.some(r => r.has?.some(h => h.type === 'host' && h.value === 'www.geekprotocol.xyz')));
});

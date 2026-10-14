import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWidgetDownloads, widgetRelease } from '../server/widget-download.js';
import handler from '../api/widget.js';

const bytes = Buffer.from('signed apk fixture');
const digest = createHash('sha256').update(bytes).digest('hex');
const release = () => ({ tag_name: 'v1.5.0', draft: false, prerelease: false, assets: [{
  name: 'kaspa-live-widget.apk', size: bytes.length, digest: `sha256:${digest}`,
  browser_download_url: 'https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/download/v1.5.0/kaspa-live-widget.apk',
}] });

test('download metadata accepts only the public signed APK and fixed repository URL', () => {
  assert.equal(widgetRelease(release()).version, '1.5.0');
  for (const mutate of [r => r.draft = true, r => r.prerelease = true, r => r.tag_name = 'v1.5.0\r\nBad',
    r => r.assets[0].browser_download_url = 'https://attacker.invalid/file.apk',
    r => r.assets[0].digest = null, r => r.assets[0].size = 100_000_000]) {
    const value = release(); mutate(value); assert.throws(() => widgetRelease(value));
  }
});

test('verified download matches exact published bytes; modified or partial bytes are rejected', async () => {
  const metadata = widgetRelease(release());
  const good = createWidgetDownloads(async () => new Response(bytes));
  assert.deepEqual(await good.download(metadata), bytes);
  for (const contents of [Buffer.from('modified apk bytes'), bytes.subarray(0, 3), Buffer.concat([bytes, bytes])]) {
    const bad = createWidgetDownloads(async () => new Response(contents));
    await assert.rejects(bad.download(metadata));
  }
});

test('release lookups cache valid metadata for five minutes and refresh afterward', async () => {
  let time = 1000; let requests = 0;
  const downloads = createWidgetDownloads(async () => { requests++; return Response.json(release()); }, () => time);
  await downloads.latest(); await downloads.latest(); assert.equal(requests, 1);
  time += 300_001; await downloads.latest(); assert.equal(requests, 2);
});

test('failed lookups do not create a success cache entry', async () => {
  let requests = 0;
  const downloads = createWidgetDownloads(async () => { requests++; return new Response('', { status: 503 }); });
  await assert.rejects(downloads.latest()); await assert.rejects(downloads.latest()); assert.equal(requests, 2);
});

test('download endpoint rejects mutation methods without contacting upstream', async () => {
  const headers = {}; let status;
  const res = { setHeader(k, v) { headers[k] = v; }, status(v) { status = v; return this; }, end() {} };
  await handler({ method: 'POST' }, res);
  assert.equal(status, 405); assert.equal(headers.Allow, 'GET'); assert.equal(headers['X-Content-Type-Options'], 'nosniff');
});

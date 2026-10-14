import { createHash } from 'node:crypto';

const repository = 'GEEKProtocol0110/kaspa-live-widget';
export const releasesUrl = `https://github.com/${repository}/releases/latest`;
const limit = 20 * 1024 * 1024;

export function widgetRelease(release) {
  const tag = release?.tag_name;
  if (!/^v\d+\.\d+\.\d+$/.test(tag) || release.draft !== false || release.prerelease !== false) throw new Error('Invalid release');
  const asset = release.assets?.find(item => item.name === 'kaspa-live-widget.apk');
  const download = `https://github.com/${repository}/releases/download/${tag}/kaspa-live-widget.apk`;
  if (!asset || asset.browser_download_url !== download || !Number.isInteger(asset.size) || asset.size < 1 || asset.size > limit ||
      !/^sha256:[a-f0-9]{64}$/.test(asset.digest)) throw new Error('Invalid APK metadata');
  return { version: tag.slice(1), size: asset.size, sha256: asset.digest.slice(7),
    download, release: `https://github.com/${repository}/releases/tag/${tag}` };
}

export function createWidgetDownloads(fetchImpl = fetch, now = Date.now) {
  let cached;
  let expires = 0;
  async function latest() {
    if (cached && now() < expires) return cached;
    const response = await fetchImpl(`https://api.github.com/repos/${repository}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Geek-Widget-Download' },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error('Release lookup unavailable');
    const parsed = widgetRelease(await response.json());
    cached = parsed; expires = now() + 300_000;
    return parsed;
  }
  async function download(release) {
    const response = await fetchImpl(release.download, { signal: AbortSignal.timeout(20_000), redirect: 'follow' });
    if (!response.ok || !response.body) throw new Error('APK unavailable');
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit || size > release.size) throw new Error('APK exceeds expected size');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = Buffer.concat(chunks);
    if (size !== release.size || createHash('sha256').update(bytes).digest('hex') !== release.sha256)
      throw new Error('APK verification failed');
    return bytes;
  }
  return { latest, download };
}

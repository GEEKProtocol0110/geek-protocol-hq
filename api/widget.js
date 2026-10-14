import { createWidgetDownloads, releasesUrl } from '../server/widget-download.js';

const downloads = createWidgetDownloads();
export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET'); return res.status(405).end();
  }
  const download = req.query?.download === '1';
  try {
    const release = await downloads.latest();
    if (download) {
      const bytes = await downloads.download(release);
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', `attachment; filename="kaspa-live-widget-v${release.version}.apk"`);
      res.setHeader('Content-Length', String(bytes.length));
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
      return res.status(200).end(bytes);
    }
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
    return res.status(200).json({ version: release.version, size: release.size, sha256: release.sha256, release: release.release });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    if (download) { res.setHeader('Location', releasesUrl); return res.status(302).end(); }
    return res.status(503).json({ available: false });
  }
}

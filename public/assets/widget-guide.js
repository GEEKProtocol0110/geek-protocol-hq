const version = document.getElementById('widget-version');
const releaseLink = document.getElementById('widget-release');
fetch('/api/widget', { signal: AbortSignal.timeout(5000) }).then(async response => {
  if (!response.ok) throw new Error('Release lookup unavailable');
  const release = await response.json();
  if (!/^\d+\.\d+\.\d+$/.test(release.version) || !Number.isInteger(release.size) ||
      release.release !== `https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/tag/v${release.version}`) return;
  version.textContent = `Current release: v${release.version} · ${(release.size / 1_000_000).toFixed(2)} MB · Signed Android APK`;
  releaseLink.href = release.release;
}).catch(() => {
  version.textContent = 'Signed Android APK · Open release notes to check the current version.';
});

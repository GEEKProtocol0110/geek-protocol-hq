import { copyWidgetText, loadWidgetScript } from './widget-install.js';

const version = document.getElementById('widget-version');
const releaseLink = document.getElementById('widget-release');
const directLink = document.getElementById('widget-direct');
const scriptButton = document.getElementById('copy-widget-script');
const scriptStatus = document.getElementById('widget-script-status');
const manualCopy = document.getElementById('widget-manual-copy');
const scriptField = document.getElementById('widget-script-text');
const pageLink = document.getElementById('widget-page-link');
const pageStatus = document.getElementById('widget-link-status');
let scriptText;

document.getElementById('copy-widget-link').addEventListener('click', async () => {
  const copied = await copyWidgetText(pageLink.value, navigator.clipboard);
  pageStatus.textContent = copied ? 'Link copied. Paste it into Chrome or Samsung Internet.' : 'Select the link and use Copy, then paste it into your browser.';
  if (!copied) { pageLink.focus(); pageLink.select(); }
});

scriptButton.addEventListener('click', async () => {
  if (scriptButton.disabled) return;
  scriptButton.disabled = true;
  scriptStatus.textContent = 'Loading the iPhone script…';
  try {
    scriptText ||= await loadWidgetScript();
    const copied = await copyWidgetText(scriptText, navigator.clipboard);
    if (copied) {
      manualCopy.hidden = true;
      scriptStatus.textContent = 'Copied. Open Scriptable, tap +, and paste the entire script.';
    } else {
      scriptField.value = scriptText;
      manualCopy.hidden = false;
      scriptStatus.textContent = 'Your browser blocked automatic copying. Select the script below and copy it manually.';
      scriptField.focus(); scriptField.select();
    }
  } catch {
    scriptStatus.textContent = 'Could not load the script. Open “View script as text” above and copy all of it, or try again in Safari.';
  } finally { scriptButton.disabled = false; }
});

document.getElementById('select-widget-script').addEventListener('click', () => {
  scriptField.focus(); scriptField.select();
  scriptStatus.textContent = 'Entire script selected. Choose Copy, then paste it into Scriptable.';
});

async function updateRelease() {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('/api/widget', { signal: controller.signal });
    if (!response.ok) throw new Error('Release unavailable');
    const release = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(release.version) || !Number.isInteger(release.size) || release.size < 1 || release.size > 20 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(release.sha256) || release.release !== `https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/tag/v${release.version}`) throw new Error('Invalid release');
    version.textContent = `v${release.version} · ${(release.size / 1_000_000).toFixed(2)} MB · Signed APK`;
    releaseLink.href = release.release;
    directLink.href = `${release.release}/kaspa-live-widget.apk`.replace('/releases/tag/', '/releases/download/');
  } catch { version.textContent = 'Signed APK · Open release notes to check the current version.'; }
  finally { clearTimeout(deadline); }
}
updateRelease();

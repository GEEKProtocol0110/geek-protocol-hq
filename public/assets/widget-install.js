export const scriptableAsset = Object.freeze({
  version: '1.0.0',
  url: '/tools/kaspa-widget/downloads/Geek-Kaspa-Widget-v1.0.0.txt',
  sha256: '06bc9bd681da92b07c67a48b5fd776bbaa49a33646a1d32daf5cafa2a86d5e4a',
});

export async function copyWidgetText(text, clipboard) {
  if (!clipboard?.writeText) return false;
  try { await clipboard.writeText(text); return true; }
  catch { return false; }
}

export async function loadWidgetScript(fetchImpl = fetch, subtle = globalThis.crypto?.subtle) {
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(scriptableAsset.url, { signal: controller.signal });
    if (!response.ok) throw new Error('Script unavailable');
    const source = await response.text();
    if (source.length > 262144 || !source.startsWith('// Variables used by Scriptable.') || !source.trimEnd().endsWith('await run();')) throw new Error('Incomplete script');
    if (!subtle) throw new Error('Script verification unavailable');
    const digest = new Uint8Array(await subtle.digest('SHA-256', new TextEncoder().encode(source)));
    const sha256 = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
    if (sha256 !== scriptableAsset.sha256) throw new Error('Script verification failed');
    return source;
  } finally { clearTimeout(deadline); }
}

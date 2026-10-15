import { normalizeGeek } from '../../assets/geek-avatar.js';
export const storePreviewKey = 'geek-store-preview-v1';
export function saveStorePreview(storage, design, now = Date.now()) {
  const clean = normalizeGeek(design, true);
  storage.setItem(storePreviewKey, JSON.stringify({ version: 1, createdAt: now, design: clean }));
}
export function takeStorePreview(storage, now = Date.now()) {
  try {
    const raw = storage?.getItem(storePreviewKey);
    if (!raw) return null;
    storage.removeItem(storePreviewKey);
    if (raw.length > 4096) return null;
    const value = JSON.parse(raw);
    if (!value || Object.keys(value).sort().join(',') !== 'createdAt,design,version' || value.version !== 1 || !Number.isSafeInteger(value.createdAt) || value.createdAt > now + 60000 || now - value.createdAt > 30 * 60000) return null;
    return normalizeGeek(value.design, true);
  } catch { return null; }
}

export const MUSIC_KEY = 'geek-thanks-music', MUSIC_VOLUME = 0.18;
// Stored choice: 'on' or 'off'. Without one, music begins on the first interaction unless reduced motion is preferred.
export const musicPreference = storage => { try { const value = storage?.getItem(MUSIC_KEY); return value === 'on' || value === 'off' ? value : ''; } catch { return ''; } };
export const saveMusicPreference = (storage, on) => { try { storage?.setItem(MUSIC_KEY, on ? 'on' : 'off'); } catch {} };
export const startsOnInteraction = (preference, reducedMotion) => preference === 'on' || (!preference && !reducedMotion);
export const musicLabel = playing => playing ? 'Mute Hall of Thanks music' : 'Play Hall of Thanks music';

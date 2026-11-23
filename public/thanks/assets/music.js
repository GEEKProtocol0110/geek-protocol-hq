import { MUSIC_VOLUME, musicLabel } from './music-core.js';
const audio = document.querySelector('[data-thanks-music]'), toggle = document.querySelector('[data-thanks-music-toggle]');
const status = document.querySelector('[data-thanks-music-status]');
if (audio && toggle) {
  audio.volume = MUSIC_VOLUME;
  const sync = () => {
    const playing = !audio.paused && !audio.ended;
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', musicLabel(playing));
    toggle.title = musicLabel(playing); toggle.dataset.playing = String(playing);
  };
  const failed = () => { sync(); if (status) status.textContent = 'The song could not play. Try the player again when your connection is ready.'; };
  toggle.addEventListener('click', async () => {
    if (!audio.paused && !audio.ended) { audio.pause(); return; }
    try { await audio.play(); } catch { failed(); }
  });
  for (const event of ['play', 'pause', 'ended']) audio.addEventListener(event, sync);
  audio.addEventListener('play', () => { if (status) status.textContent = ''; });
  audio.addEventListener('error', failed);
  toggle.hidden = false; sync();
}

import { MUSIC_VOLUME, musicPreference, saveMusicPreference, startsOnInteraction, musicLabel } from './music-core.js';
const audio = document.querySelector('[data-thanks-music]'), toggle = document.querySelector('[data-thanks-music-toggle]');
if (audio && toggle) {
  const storage = (() => { try { return window.localStorage; } catch { return null; } })();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  audio.volume = MUSIC_VOLUME; audio.loop = true;
  const sync = () => { const playing = !audio.paused; toggle.setAttribute('aria-pressed', String(playing)); toggle.setAttribute('aria-label', musicLabel(playing)); toggle.title = musicLabel(playing); toggle.dataset.playing = String(playing); };
  const play = () => audio.play().then(sync, sync);
  const events = ['pointerdown', 'keydown'];
  const stopWaiting = () => events.forEach(type => document.removeEventListener(type, firstInteraction, true));
  function firstInteraction(event) { stopWaiting(); if (!toggle.contains(event.target)) play(); }
  toggle.addEventListener('click', () => { stopWaiting(); if (audio.paused) { saveMusicPreference(storage, true); play(); } else { saveMusicPreference(storage, false); audio.pause(); sync(); } });
  audio.addEventListener('play', sync); audio.addEventListener('pause', sync);
  toggle.hidden = false; sync();
  if (startsOnInteraction(musicPreference(storage), reduced)) events.forEach(type => document.addEventListener(type, firstInteraction, { capture: true, passive: true }));
}

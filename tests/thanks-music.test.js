import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { MUSIC_KEY, MUSIC_VOLUME, musicPreference, saveMusicPreference, startsOnInteraction, musicLabel } from '../public/thanks/assets/music-core.js';

const memory = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) }; };

test('Hall of Thanks music stays quiet and remembers the visitor choice', () => {
  assert.ok(MUSIC_VOLUME > 0 && MUSIC_VOLUME <= 0.2);
  const storage = memory(); assert.equal(musicPreference(storage), '');
  saveMusicPreference(storage, false); assert.equal(storage.getItem(MUSIC_KEY), 'off'); assert.equal(musicPreference(storage), 'off');
  saveMusicPreference(storage, true); assert.equal(musicPreference(storage), 'on');
  assert.equal(musicPreference({ getItem: () => { throw new Error('blocked'); } }), '');
  assert.equal(musicPreference(null), '');
  assert.equal(startsOnInteraction('off', false), false); assert.equal(startsOnInteraction('on', true), true);
  assert.equal(startsOnInteraction('', false), true); assert.equal(startsOnInteraction('', true), false);
  assert.match(musicLabel(true), /Mute/); assert.match(musicLabel(false), /Play/);
});

test('Hall of Thanks music is scoped to the page, never autoplays and uses local small files', () => {
  const html = readFileSync('public/thanks/index.html', 'utf8');
  const tag = html.match(/<audio[^>]*>/)[0];
  assert.doesNotMatch(tag, /autoplay/); assert.match(tag, /preload="none"/);
  assert.match(html, /data-thanks-music-toggle[^>]*|aria-label="Play Hall of Thanks music"/);
  assert.match(html, /src="\/thanks\/assets\/music\.js"/);
  for (const file of ['hall-of-thanks.mp3', 'hall-of-thanks.ogg']) { assert.match(html, new RegExp(`/thanks/audio/${file.replace('.', '\\.')}`)); assert.ok(statSync(`public/thanks/audio/${file}`).size < 1_200_000); }
  for (const page of ['index.html', 'study/index.html', 'profile/index.html']) assert.doesNotMatch(readFileSync(`public/${page}`, 'utf8'), /thanks-music|music\.js/);
  assert.doesNotMatch(readFileSync('public/thanks/assets/music.js', 'utf8'), /innerHTML|autoplay/);
});

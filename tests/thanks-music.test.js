import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { MUSIC_VOLUME, musicLabel } from '../public/thanks/assets/music-core.js';

const html = readFileSync('public/thanks/index.html', 'utf8');
test('credits song is optional, page-local and usable without JavaScript', () => {
  const tag = html.match(/<audio[^>]*>/)[0];
  assert.match(tag, /controls/); assert.match(tag, /preload="none"/);
  assert.doesNotMatch(tag, /autoplay|loop/);
  assert.match(tag, /aria-label="GEEK Credits Song"/);
  assert.match(html, /\/thanks\/audio\/geek-credits-song\.mp3/);
  assert.ok(statSync('public/thanks/audio/geek-credits-song.mp3').size < 4_000_000);
  assert.doesNotMatch(html, /\/thanks\/audio\/hall-of-thanks\./);
  for (const page of ['index.html', 'study/index.html', 'profile/index.html']) assert.doesNotMatch(readFileSync(`public/${page}`, 'utf8'), /thanks-music|music\.js/);
});

test('only explicit Play starts the song; pause, finish and rejected playback update the shortcut', async () => {
  const events = new Map(), clicks = new Map(), attributes = new Map();
  let plays = 0, reject = false;
  const audio = { paused: true, ended: false,
    addEventListener: (type, fn) => events.set(type, [...(events.get(type) || []), fn]),
    async play() { plays++; if (reject) throw new Error('offline'); this.paused = false; emit('play'); },
    pause() { this.paused = true; emit('pause'); } };
  const emit = type => { for (const fn of events.get(type) || []) fn(); };
  const toggle = { hidden: true, dataset: {}, addEventListener: (type, fn) => clicks.set(type, fn), setAttribute: (k, v) => attributes.set(k, v) };
  const status = { textContent: '' };
  const document = { querySelector: selector => selector === '[data-thanks-music]' ? audio : selector === '[data-thanks-music-toggle]' ? toggle : status,
    addEventListener() { assert.fail('Unrelated page interactions cannot start music'); } };
  const source = readFileSync('public/thanks/assets/music.js', 'utf8').replace(/^import[^\n]+\n/, '');
  runInNewContext(source, { document, MUSIC_VOLUME, musicLabel });
  assert.equal(plays, 0); assert.equal(toggle.hidden, false);
  await clicks.get('click')(); assert.equal(plays, 1); assert.equal(attributes.get('aria-label'), 'Pause GEEK Credits Song');
  await clicks.get('click')(); assert.equal(audio.paused, true); assert.equal(attributes.get('aria-pressed'), 'false');
  audio.ended = true; emit('ended'); assert.equal(attributes.get('aria-label'), 'Play GEEK Credits Song');
  reject = true; await clicks.get('click')(); assert.match(status.textContent, /could not play/);
  assert.equal(attributes.get('aria-pressed'), 'false');
});

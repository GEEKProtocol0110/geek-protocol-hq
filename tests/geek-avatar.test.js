import test from 'node:test';
import assert from 'node:assert/strict';
import { customGeekId, geekParts, defaultGeek, normalizeGeek, geekSvg, geekDescription } from '../public/assets/geek-avatar.js';

test('every supported cosmetic has a valid accessible rendering with no arbitrary markup', () => {
  assert.equal(customGeekId, 'giga-builder');
  for (const [key, part] of Object.entries(geekParts)) for (const [choice, label] of part.choices) {
    const design = {...defaultGeek, [key]: choice}; assert.deepEqual(normalizeGeek(design, true), design);
    const svg = geekSvg(design); assert.match(svg, /^<svg /); assert.match(svg, /<\/svg>$/); assert(!/style=|<script|href=|onload=/.test(svg)); assert(geekDescription(design).includes(label));
    if (choice !== defaultGeek[key]) assert.notEqual(svg, geekSvg(defaultGeek), `${key} ${choice} changes the rendered Geek`);
  }
  const unsafe = {...defaultGeek, palette: '" onload="alert(1)', head: '<script>'};
  assert.throws(() => normalizeGeek(unsafe, true), /INVALID_AVATAR_CUSTOMIZATION/); assert.equal(geekSvg(unsafe), geekSvg(defaultGeek));
  assert.deepEqual(normalizeGeek(null), defaultGeek);
});

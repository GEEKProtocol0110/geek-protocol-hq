import test from 'node:test';
import assert from 'node:assert/strict';
import { customGeekId, geekParts, defaultGeek, personalGeek, normalizeGeek, geekSvg, geekDescription, visibleGeekParts } from '../public/assets/geek-avatar.js';

test('every visible robot and personal cosmetic renders safely and has an accessible description', () => {
  assert.equal(customGeekId, 'giga-builder');
  for (const starter of [defaultGeek, personalGeek]) {
    for (const [key, part] of visibleGeekParts(starter)) for (const [choice, label] of part.choices) {
      if (starter.kind === 'human' && key === 'head' && choice === 'antenna') continue;
      const design = { ...starter, [key]: choice };
      if (design.kind === 'human' && design.head === 'antenna') design.head = 'plain';
      assert.deepEqual(normalizeGeek(design, true), design);
      const svg = geekSvg(design);
      assert.match(svg, /^<svg /); assert.match(svg, /<\/svg>$/);
      assert(!/style=|<script|href=|onload=/.test(svg));
      if (!(starter.kind === 'human' && key === 'head' && choice === 'plain')) assert(geekDescription(design).includes(label));
      if (choice !== starter[key]) assert.notEqual(svg, geekSvg(starter), `${starter.kind}: ${key} ${choice} changes the rendered Geek`);
    }
  }
  assert(!visibleGeekParts(defaultGeek).some(([key]) => key === 'skin'));
  const unsafe = { ...personalGeek, skin: '" onload="alert(1)', hair: '<script>' };
  assert.throws(() => normalizeGeek(unsafe, true), /INVALID_AVATAR_CUSTOMIZATION/);
  assert(!geekSvg(unsafe).includes('alert(1)'));
  assert.deepEqual(normalizeGeek(null), defaultGeek);
});

test('version-one robot designs migrate predictably; strict validation rejects unknown, incomplete and mixed versions', () => {
  const legacy = { version: 1, palette: 'cyan', head: 'headphones', face: 'focus', torso: 'dag', arms: 'guard', legs: 'runner', back: 'pack', fx: 'orbit' };
  const result = normalizeGeek(legacy, true);
  assert.equal(result.version, 2); assert.equal(result.kind, 'robot');
  for (const [key, value] of Object.entries(legacy)) if (key !== 'version') assert.equal(result[key], value);
  assert.deepEqual(normalizeGeek(result, true), result);
  for (const invalid of [null, [], { ...legacy, skin: 'fair' }, { ...legacy, palette: 'rose' }, { ...personalGeek, version: 3 }, { ...personalGeek, kind: 'nft' }, { ...personalGeek, head: 'antenna' }, { ...personalGeek, eyeColor: 'red' }, { ...personalGeek, html: '<svg>' }, Object.fromEntries(Object.entries(personalGeek).filter(([key]) => key !== 'skin'))]) {
    assert.throws(() => normalizeGeek(invalid, true), /INVALID_AVATAR_CUSTOMIZATION/);
  }
  assert(geekDescription(personalGeek).includes('Personal Geek'));
  assert(geekDescription(personalGeek).includes('No headgear'));
});

test('front and rear previews are bounded authored views, not user-provided SVG', () => {
  for (const starter of [defaultGeek, personalGeek]) {
    const design = { ...starter, back: 'pack', head: 'cap', fx: 'crown' };
    const front = geekSvg(design), rear = geekSvg(design, 'back');
    assert.notEqual(front, rear); assert.match(rear, /^<svg /); assert(!/onload=|<script|href=/.test(rear));
    assert.equal(geekSvg(design, '<script>'), front);
    assert.notEqual(geekSvg({ ...design, back: 'wings' }, 'back'), rear);
  }
});

test('career roadmap uses existing XP thresholds and earned cosmetics remain available after prestige', async () => {
  const { deriveCareerMilestones, deriveProgression } = await import('../server/progression.js');
  const { unlockedGeekEffects } = await import('../public/assets/geek-avatar.js');
  const state = { version: 1, prestige: 0, xpBaseline: 0, history: [] };
  for (const [xp, pulse, next] of [[0, false, 'explorer'], [999, false, 'explorer'], [1000, true, 'pathfinder'], [2250, true, 'signal-master'], [12250, true, 'operator']]) {
    const profile = { xp, prestigeState: state }, p = deriveProgression(profile), milestones = deriveCareerMilestones(profile);
    assert.equal(unlockedGeekEffects(p).includes('pulse'), pulse); assert(!unlockedGeekEffects(p).includes('crown'));
    assert.equal(milestones.find(m => !m.unlocked).id, next);
    assert(milestones.every(m => m.xpRemaining >= 0 && m.progressPercent >= 0 && m.progressPercent <= 100));
  }
  const reset = { xp: 12250, prestigeState: { ...state, prestige: 1, xpBaseline: 12250 } };
  assert.equal(deriveProgression(reset).level, 1); assert.deepEqual(unlockedGeekEffects(deriveProgression(reset)), ['pulse', 'crown']);
  assert(deriveCareerMilestones(reset).every(m => m.unlocked));
});

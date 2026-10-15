import { geekParts, normalizeGeek } from '../../assets/geek-avatar.js';
import { powerups } from '../../economy/assets/catalog.js';

const slots = { outfit: 'clothing', pants: 'clothing', legs: 'clothing', head: 'accessories', eyewear: 'accessories', back: 'equipment', arms: 'equipment', fx: 'perks' };
export const storeGroups = Object.freeze({ all: 'Everything', clothing: 'Clothing', accessories: 'Accessories', equipment: 'Equipment & tools', lifelines: 'Lifelines', perks: 'Perks & bonuses' });
export const storeItems = Object.freeze([
  ...Object.entries(slots).flatMap(([part, group]) => geekParts[part].choices.filter(([value]) => !['none', 'plain', 'classic'].includes(value)).map(([value, name]) => ({
    id: `${part}-${value}`, name, group, part, value, modes: geekParts[part].modes || ['human', 'robot'],
    description: `${geekParts[part].label} for your Geek. Cosmetic only.`,
    availability: part === 'fx' && ['pulse', 'crown'].includes(value) ? 'career' : 'free',
    priceRaw: part === 'fx' && ['pulse', 'crown'].includes(value) ? null : '0',
    rule: value === 'pulse' ? 'Reach level 5 to save. Preview freely.' : value === 'crown' ? 'Reach Prestige 1 to save. Preview freely.' : 'Free studio part. Review your look in the studio before saving.'
  }))),
  ...powerups.map(p => ({ id: p.id, name: p.name, group: 'lifelines', description: p.description, rule: p.rules, availability: p.practice?.enabled ? 'free-practice' : 'planned', practiceUrl: p.practice?.enabled ? p.practice.url : null, priceRaw: null })),
  { id: 'companion-themes', name: 'Companion themes', group: 'perks', description: 'A proposed way to personalize your learning companion.', rule: 'Cosmetic perk concept. Design and availability are still being worked out.', availability: 'planned', priceRaw: null },
  { id: 'learning-streak', name: 'Learning streak bonus', group: 'perks', description: 'A proposed cosmetic celebration for returning to learn.', rule: 'Eligibility, limits and any reward budget are still being designed. No bonus is granted here.', availability: 'planned', priceRaw: null }
].map(item => Object.freeze({ ...item, purchasesEnabled: false, grantsRewards: false })));

export function tryStoreItem(design, id) {
  const item = storeItems.find(i => i.id === id);
  const draft = normalizeGeek(design, true);
  if (!item?.part || !item.modes.includes(draft.kind) || (draft.kind === 'human' && item.part === 'head' && item.value === 'antenna')) throw new Error('STORE_ITEM_UNAVAILABLE');
  return normalizeGeek({ ...draft, [item.part]: item.value }, true);
}

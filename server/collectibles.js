import { collectionPreview } from './geek-collection.js';

const STARTER_STICKERS = {
  'giga-core': 2,
  'kaspa-k': 2,
  'dag-node': 1,
  'signal-verified': 1
};

export const avatarCatalog = [
  { id: 'giga-genesis', name: 'GIGA Genesis', tier: 'Genesis', asset: '/assets/x-geek-profile.jpg', requirement: 'Starter identity', unlock: () => true },
  { id: 'kaspa-culture', name: 'Kaspa Culture', tier: 'Rare', asset: '/assets/kaspa-culture.png', requirement: 'Reach level 5', unlock: ({ progression }) => progression.level >= 5 || progression.prestige > 0 },
  { id: 'quiz-quest', name: 'Quiz Quest', tier: 'Epic', asset: '/assets/quiz-quest.png', requirement: 'Reach level 10', unlock: ({ progression }) => progression.level >= 10 || progression.prestige > 0 },
  { id: 'omniscient-grid', name: 'Omniscient Grid', tier: 'Legendary', asset: '/assets/omniscient-grid.png', requirement: 'Reach Prestige 1', unlock: ({ progression }) => progression.prestige >= 1 },
  { id: 'protocol-core', name: 'Protocol Core', tier: 'Mythic', asset: '/assets/geek-protocol-logo.png', requirement: 'Protect the profile with a Kaspa wallet', unlock: ({ walletProtected }) => walletProtected }
];

export const stickerCatalog = [
  { id: 'giga-core', name: 'GIGA Core', rarity: 'Common', glyph: 'G', color: '#f6c643' },
  { id: 'kaspa-k', name: 'Kaspa K', rarity: 'Common', glyph: 'K', color: '#70e6dc' },
  { id: 'dag-node', name: 'DAG Node', rarity: 'Common', glyph: '◇', color: '#70e6dc' },
  { id: 'signal-verified', name: 'Signal Verified', rarity: 'Common', glyph: '✓', color: '#72e6a1' },
  { id: 'perfect-signal', name: 'Perfect Signal', rarity: 'Rare', glyph: '10', color: '#f6c643' },
  { id: 'level-up', name: 'Level Up', rarity: 'Rare', glyph: '↗', color: '#70e6dc' },
  { id: 'ace-eye', name: 'A.C.E. Eye', rarity: 'Rare', glyph: '◉', color: '#a993ff' },
  { id: 'blockdag', name: 'BlockDAG', rarity: 'Epic', glyph: '⬡', color: '#70e6dc' },
  { id: 'quiz-quest', name: 'Quiz Quest', rarity: 'Epic', glyph: '?', color: '#f6c643' },
  { id: 'toccata', name: 'Toccata', rarity: 'Epic', glyph: 'T', color: '#ff8f83' },
  { id: 'prestige-star', name: 'Prestige Star', rarity: 'Legendary', glyph: '✦', color: '#f6c643' },
  { id: 'all-hope', name: 'All Hope', rarity: 'Mythic', glyph: '∞', color: '#ffffff' }
];

const stickerIds = new Set(stickerCatalog.map((sticker) => sticker.id));
const count = (value) => Math.max(0, Math.floor(Number(value) || 0));

export const defaultStickerInventory = () => ({ ...STARTER_STICKERS });
export const isStickerId = (value) => stickerIds.has(String(value || ''));

export const normalizeStickerInventory = (value = {}) => Object.fromEntries(stickerCatalog.map((sticker) => [sticker.id, count(value?.[sticker.id])]).filter(([, quantity]) => quantity > 0));

export const collectibleProfile = (profile, context) => {
  const inventory = normalizeStickerInventory(profile.stickerInventory);
  const reserved = normalizeStickerInventory(profile.stickerReserved);
  const avatars = avatarCatalog.map(({ unlock, ...avatar }) => ({ ...avatar, owned: Boolean(unlock(context)) }));
  const selected = avatars.find((avatar) => avatar.id === profile.avatarId && avatar.owned) || avatars[0];
  return {
    avatar: selected,
    avatars,
    stickers: stickerCatalog.map((sticker) => ({
      ...sticker,
      quantity: count(inventory[sticker.id]),
      reserved: count(reserved[sticker.id]),
      available: Math.max(0, count(inventory[sticker.id]) - count(reserved[sticker.id]))
    })),
    blueprint: collectionPreview(),
    collectionStatus: 'OFF-CHAIN ALPHA',
    onChainTransfersEnabled: false
  };
};

const grant = (profile, stickerId, quantity = 1) => {
  const inventory = normalizeStickerInventory(profile.stickerInventory);
  inventory[stickerId] = count(inventory[stickerId]) + quantity;
  profile.stickerInventory = inventory;
  return stickerId;
};

export const awardRoundStickers = (profile, input, progressionBefore, progressionAfter) => {
  const awarded = [];
  if (input.answered >= 5 && input.correct === input.answered) awarded.push(grant(profile, 'perfect-signal'));
  if (progressionAfter.prestige > progressionBefore.prestige) {
    awarded.push(grant(profile, 'prestige-star'));
    awarded.push(grant(profile, 'all-hope'));
  } else if (progressionAfter.level > progressionBefore.level) {
    awarded.push(grant(profile, 'level-up'));
    if (progressionAfter.level % 5 === 0) awarded.push(grant(profile, ['ace-eye', 'blockdag', 'quiz-quest', 'toccata'][(progressionAfter.level / 5 - 1) % 4]));
  }
  return awarded;
};

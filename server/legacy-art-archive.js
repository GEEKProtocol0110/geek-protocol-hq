export const legacyArtBlueprint = Object.freeze({
  schemaVersion: '1.0.0',
  title: 'Geek Protocol Legacy Art Archive',
  recoveredAssetCount: 10,
  approvedAssetCount: 0,
  status: 'archival-concept-only',
  sourceWindow: 'July 2025',
  editionMapping: 'unmapped',
  onChainOwnershipActive: false,
  mintReady: false,
  independentlyReviewed: false
});

const records = Object.freeze([
  {
    id: 'legacy-ace-corrupted-code',
    name: 'A.C.E. — Corrupted Code',
    character: 'A.C.E.',
    visibleTier: null,
    originalFilename: 'A.C.E. Emerges from Corrupted Code.png',
    sourceCreatedAt: '2025-07-15T17:41:46.311967Z',
    fileName: 'ace-corrupted-code.webp',
    alt: 'A luminous blue A.C.E. dataform standing behind a vintage computer in a dark archive.',
    note: 'Early A.C.E. origin concept. Preserved as lore art; not mapped to a mint edition.'
  },
  {
    id: 'legacy-ai-geek-common',
    name: 'AI Geek',
    character: 'AI Geek',
    visibleTier: 'Common',
    originalFilename: 'Futuristic AI Geek and Companion.png',
    sourceCreatedAt: '2025-07-16T12:43:47.166550Z',
    fileName: 'ai-geek-common.webp',
    alt: 'Pixel-art AI Geek wearing a circuit hoodie beside a small robot companion.',
    note: 'The artwork visibly identifies this concept as AI Geek Common.'
  },
  {
    id: 'legacy-speedrunner-geek-legendary',
    name: 'Speedrunner Geek',
    character: 'Speedrunner Geek',
    visibleTier: 'Legendary',
    originalFilename: 'Legendary Speedrunner Geek in Action.png',
    sourceCreatedAt: '2025-07-15T18:36:09.808382Z',
    fileName: 'speedrunner-geek-legendary.webp',
    alt: 'Pixel-art crowned speedrunner holding a trophy while sprinting through a neon trail.',
    note: 'The artwork visibly identifies this concept as Speedrunner Geek Legendary.'
  },
  {
    id: 'legacy-hacker-geek',
    name: 'Hacker Geek',
    character: 'Hacker Geek',
    visibleTier: null,
    originalFilename: 'Hacker Geek in Pixel Art.png',
    sourceCreatedAt: '2025-07-16T11:40:54.405200Z',
    fileName: 'hacker-geek-concept.webp',
    alt: 'Pixel-art hooded Hacker Geek wearing dark glasses and using a green laptop.',
    note: 'Legacy character concept. No reliable edition or rarity mapping survived.'
  },
  {
    id: 'legacy-sysadmin-geek',
    name: 'SysAdmin Geek',
    character: 'SysAdmin Geek',
    visibleTier: null,
    originalFilename: 'Pixel Art SysAdmin Geek.png',
    sourceCreatedAt: '2025-07-16T12:00:54.674747Z',
    fileName: 'sysadmin-geek-concept.webp',
    alt: 'Pixel-art SysAdmin Geek carrying a server and a red maintenance tool.',
    note: 'Legacy base concept. It remains distinct from the surviving Epic variant.'
  },
  {
    id: 'legacy-puzzle-geek-common',
    name: 'Puzzle Geek',
    character: 'Puzzle Geek',
    visibleTier: 'Common',
    originalFilename: 'Pixelated Puzzle Enthusiast in Action.png',
    sourceCreatedAt: '2025-07-21T00:18:22.575969Z',
    fileName: 'puzzle-geek-common.webp',
    alt: 'Pixel-art Puzzle Geek holding a multicolored cube with puzzle symbols around him.',
    note: 'The artwork visibly identifies this concept as Puzzle Geek Common.'
  },
  {
    id: 'legacy-streamer-geek-common',
    name: 'Streamer Geek',
    character: 'Streamer Geek',
    visibleTier: 'Common',
    originalFilename: 'Pixelated Streamer in Retro Style.png',
    sourceCreatedAt: '2025-07-18T10:46:05.071289Z',
    fileName: 'streamer-geek-common.webp',
    alt: 'Pixel-art Streamer Geek wearing headphones at a microphone and control deck.',
    note: 'The artwork visibly identifies this concept as Streamer Geek Common.'
  },
  {
    id: 'legacy-vr-geek-rare',
    name: 'VR Geek',
    character: 'VR Geek',
    visibleTier: 'Rare',
    originalFilename: 'Pixelated VR Geek in Action.png',
    sourceCreatedAt: '2025-07-14T18:21:14.483410Z',
    fileName: 'vr-geek-rare.webp',
    alt: 'Pixel-art VR Geek wearing a bright blue headset and motion gloves.',
    note: 'The artwork visibly identifies this concept as VR Geek Rare.'
  },
  {
    id: 'legacy-sysadmin-geek-epic',
    name: 'SysAdmin Geek',
    character: 'SysAdmin Geek',
    visibleTier: 'Epic',
    originalFilename: 'SysAdmin Geek at Work.png',
    sourceCreatedAt: '2025-07-16T12:05:18.315470Z',
    fileName: 'sysadmin-geek-epic.webp',
    alt: 'Pixel-art Epic SysAdmin Geek working at a terminal in a purple server room.',
    note: 'The artwork visibly identifies this concept as SysAdmin Geek Epic.'
  },
  {
    id: 'legacy-vr-geek',
    name: 'VR Geek',
    character: 'VR Geek',
    visibleTier: null,
    originalFilename: 'VR Geek in Retro Pixel Style.png',
    sourceCreatedAt: '2025-07-14T16:52:00.138894Z',
    fileName: 'vr-geek-concept.webp',
    alt: 'Pixel-art VR Geek holding a motion controller against a blue background.',
    note: 'Early VR Geek base concept. No reliable edition or rarity mapping survived.'
  }
]);

export function listLegacyArtRecords() {
  return structuredClone(records);
}

export function legacyArtManifest(hashes = {}) {
  return {
    blueprint: structuredClone(legacyArtBlueprint),
    records: records.map((record) => ({
      ...structuredClone(record),
      asset: {
        path: `/collection/archive/legacy-art/${record.fileName}`,
        sha256: hashes[record.fileName] ?? null
      },
      production: {
        status: 'legacy-recovered',
        approved: false,
        mintReady: false,
        mappedEdition: null,
        onChainOwnershipActive: false
      }
    }))
  };
}

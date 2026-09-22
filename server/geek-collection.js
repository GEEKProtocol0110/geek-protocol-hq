const TIERS = [
  { name: 'Common', count: 250, aura: 'Signal Glow' },
  { name: 'Rare', count: 125, aura: 'Twin Pulse' },
  { name: 'Epic', count: 75, aura: 'DAG Current' },
  { name: 'Legendary', count: 40, aura: 'Golden Proof' },
  { name: 'Elite', count: 8, aura: 'Cognoscenti Crown' },
  { name: 'Mythic', count: 2, aura: 'Genesis Field' }
];

const DISTRICTS = [
  { id: 'kaspa-core', name: 'Kaspa Core', category: 'kaspa', discipline: 'BlockDAG literacy', palette: ['#70e6dc', '#07100f', '#eafdf8'], environment: 'Parallel block foundry', credo: 'Useful work is never wasted.', motif: 'interlocking DAG nodes' },
  { id: 'arcade-foundry', name: 'Arcade Foundry', category: 'video-games', discipline: 'Video game systems', palette: ['#f6c643', '#15100a', '#ffefb2'], environment: 'Infinite cabinet hall', credo: 'Every failure teaches the next input.', motif: 'pixel circuits' },
  { id: 'nebula-archive', name: 'Nebula Archive', category: 'science-fiction', discipline: 'Science fiction', palette: ['#a993ff', '#0c0920', '#e8e0ff'], environment: 'Orbital memory library', credo: 'Imagine far enough to find the future.', motif: 'star maps' },
  { id: 'tech-spire', name: 'Tech Spire', category: 'technology', discipline: 'Technology', palette: ['#3cc8ff', '#07131b', '#dff7ff'], environment: 'Vertical systems laboratory', credo: 'Understand the tool before trusting it.', motif: 'stacked logic gates' },
  { id: 'cinema-vault', name: 'Cinema Vault', category: 'movies', discipline: 'Movies', palette: ['#ff8f83', '#1a0b0b', '#ffe3df'], environment: 'Frame-sealed screening chamber', credo: 'Every frame hides a decision.', motif: 'film apertures' },
  { id: 'history-relay', name: 'History Relay', category: 'history', discipline: 'History', palette: ['#d69d62', '#170f08', '#ffe9ce'], environment: 'Chronology transmission station', credo: 'Memory is civilization’s checksum.', motif: 'layered timelines' },
  { id: 'comic-forge', name: 'Comic Forge', category: 'comics', discipline: 'Comics', palette: ['#ff5f86', '#190812', '#ffe1eb'], environment: 'Panel-powered fabrication bay', credo: 'A symbol can move a world.', motif: 'halftone bursts' },
  { id: 'culture-circuit', name: 'Culture Circuit', category: 'pop-culture', discipline: 'Pop culture', palette: ['#73e69b', '#07150d', '#ddffe9'], environment: 'Live signal amphitheater', credo: 'Shared knowledge becomes culture.', motif: 'broadcast waves' }
];

const ARCHETYPES = [
  { name: 'Archivist', function: 'Preserves sources and reconstructs lost context', silhouette: 'long memory mantle' },
  { name: 'Builder', function: 'Turns verified ideas into working systems', silhouette: 'heavy utility frame' },
  { name: 'Cipher', function: 'Finds patterns hidden inside noisy signals', silhouette: 'narrow stealth chassis' },
  { name: 'Explorer', function: 'Maps the unknown edges of the Grid', silhouette: 'range-ready scout frame' },
  { name: 'Guardian', function: 'Protects fair play and community knowledge', silhouette: 'shielded sentinel frame' },
  { name: 'Mentor', function: 'Converts hard lessons into clear paths', silhouette: 'open beacon mantle' },
  { name: 'Operator', function: 'Keeps critical Grid systems online', silhouette: 'modular control rig' },
  { name: 'Scout', function: 'Detects new questions before the signal fades', silhouette: 'light antenna frame' },
  { name: 'Tactician', function: 'Plans challenge routes through uncertain data', silhouette: 'layered command shell' },
  { name: 'Visionary', function: 'Models futures the Grid has not reached', silhouette: 'halo projection frame' }
];

const PREFIXES = ['Axiom', 'Binary', 'Cipher', 'Delta', 'Echo', 'Flux', 'Ghost', 'Helix', 'Ion', 'Joule', 'Kinetic', 'Lumen', 'Matrix', 'Neon', 'Orbit', 'Pulse', 'Quantum', 'Relay', 'Synapse', 'Tessera', 'Umbra', 'Vector', 'Wave', 'Xeno', 'Zenith'];
const SUFFIXES = ['Beacon', 'Circuit', 'Drift', 'Engine', 'Forge', 'Glyph', 'Harbor', 'Index', 'Junction', 'Kernel', 'Lens', 'Module', 'Nexus', 'Oracle', 'Prism', 'Quorum', 'Relay', 'Signal', 'Thread', 'Vault'];
const FRAMES = ['Compact', 'Agile', 'Balanced', 'Armored', 'Ascendant'];
const VISORS = ['Mono Scan', 'Twin Lens', 'Spectrum Bar', 'Glyph Mask', 'Open Holo'];
const CORES = ['Knowledge Orb', 'Proof Reactor', 'Curiosity Engine', 'Memory Lattice', 'Signal Heart'];
const TOOLS = ['Source Scanner', 'DAG Compass', 'Question Deck', 'Logic Gauntlet', 'Archive Key', 'Signal Staff', 'Builder Kit', 'Holo Slate', 'Proof Shield', 'Beacon Drone'];
const TEMPERAMENTS = ['Curious', 'Methodical', 'Fearless', 'Patient', 'Playful'];
const SIGNALS = ['Curiosity', 'Clarity', 'Courage', 'Memory', 'Logic', 'Creativity', 'Focus', 'Empathy', 'Resilience', 'Wonder'];
const POSES = ['Ready', 'Teaching', 'Scanning', 'Building', 'Defending', 'Discovering', 'Broadcasting', 'Thinking'];
const ELITE_NAMES = ['The Nodekeeper', 'The Gamewright', 'The Star Scribe', 'The Systems Architect', 'The Framekeeper', 'The Chronologist', 'The Panel Smith', 'The Culture Carrier'];

const countBeforeTier = (target) => {
  let count = 0;
  for (const tier of TIERS) {
    if (tier.name === target) return count;
    count += tier.count;
  }
  return count;
};

const tierForNumber = (number) => {
  let ceiling = 0;
  for (const tier of TIERS) {
    ceiling += tier.count;
    if (number <= ceiling) return tier;
  }
  return TIERS.at(-1);
};

const pick = (values, number, salt) => values[(Math.imul(number + salt, 2654435761) >>> 0) % values.length];
const callsignFor = (number) => `${PREFIXES[(number - 1) % PREFIXES.length]} ${SUFFIXES[Math.floor((number - 1) / PREFIXES.length) % SUFFIXES.length]}`;

const identityName = (number, district) => {
  if (number === 499) return 'GIGA';
  if (number === 500) return 'A.C.E.';
  if (number >= 491) return `${ELITE_NAMES[number - 491]} of ${district.name}`;
  return callsignFor(number);
};

export const identityForNumber = (number) => {
  if (!Number.isInteger(number) || number < 1 || number > 500) throw new Error('GEEK_EDITION_INVALID');
  const district = DISTRICTS[(number - 1) % DISTRICTS.length];
  const archetype = ARCHETYPES[(number - 1) % ARCHETYPES.length];
  const tier = tierForNumber(number);
  const name = identityName(number, district);
  const role = number === 499 ? 'Community Heart' : number === 500 ? 'Protocol Mind' : number >= 491 ? 'Cognoscenti' : archetype.name;
  const signal = pick(SIGNALS, number, 41);
  const frame = number >= 491 ? 'Ascendant' : pick(FRAMES, number, 3);
  const core = number === 499 ? 'Community Heart' : number === 500 ? 'Cerebral Engine' : pick(CORES, number, 11);
  const artStatus = number >= 499 ? 'anchor-concept' : 'design-pending';
  const id = `geek-${String(number).padStart(3, '0')}`;
  return {
    schemaVersion: '1.0', collection: 'The Omniscient Grid', symbol: 'GEEK-500', id, number, name,
    description: `${name} is ${number >= 491 ? 'a high-order identity' : `a ${archetype.name.toLowerCase()}`} from ${district.name}, carrying the ${signal} signal through the Omniscient Grid.`,
    tier: tier.name, district: district.id, districtName: district.name, category: district.category, discipline: district.discipline, role,
    lore: {
      sector: `GRID-${String(DISTRICTS.indexOf(district) + 1).padStart(2, '0')}.${String(number).padStart(3, '0')}`,
      home: district.environment, credo: district.credo,
      dispatch: `${name} ${archetype.function.charAt(0).toLowerCase()}${archetype.function.slice(1)}. Its field signal is ${signal.toLowerCase()}.`,
      alignment: number === 499 ? 'GIGA / community' : number === 500 ? 'A.C.E. / protocol' : 'Cognoscenti / learner'
    },
    traits: {
      archetype: role, frame, silhouette: archetype.silhouette, visor: pick(VISORS, number, 7), core,
      tool: pick(TOOLS, number, 17), temperament: pick(TEMPERAMENTS, number, 23), signal,
      pose: pick(POSES, number, 31), aura: tier.aura, motif: district.motif, palette: [...district.palette]
    },
    metadata: {
      externalUrl: `https://www.geekprotocol.xyz/collection/#${id}`, image: null,
      attributes: [
        { trait_type: 'Edition', value: number }, { trait_type: 'Tier', value: tier.name },
        { trait_type: 'District', value: district.name }, { trait_type: 'Archetype', value: role },
        { trait_type: 'Signal', value: signal }, { trait_type: 'Frame', value: frame },
        { trait_type: 'Visor', value: pick(VISORS, number, 7) }, { trait_type: 'Core', value: core }
      ]
    },
    production: {
      artStatus, approved: false, sourcePath: `collection/source/${id}.source`,
      imagePath: `collection/images/${id}.png`, metadataPath: `collection/metadata/${id}.json`,
      imageSha256: null, metadataSha256: null
    },
    utility: { type: 'Identity and cosmetic access only', competitiveAdvantage: false, payoutMultiplier: false, onChainOwnershipActive: false }
  };
};

export const geekCollectionBlueprint = Object.freeze({
  schemaVersion: '1.0', name: 'The Omniscient Grid', symbol: 'GEEK-500', supply: 500,
  chain: 'Kaspa-ready; deployment not configured', status: 'DESIGN BLUEPRINT',
  utility: 'Identity and cosmetic access only; no competitive advantage',
  anchors: [identityForNumber(499), identityForNumber(500)],
  tiers: TIERS.map((tier) => ({ name: tier.name, count: tier.count, firstEdition: countBeforeTier(tier.name) + 1, lastEdition: countBeforeTier(tier.name) + tier.count })),
  districts: DISTRICTS.map((district) => ({ ...district, palette: [...district.palette] })),
  artStatuses: { 'design-pending': 498, 'anchor-concept': 2, approved: 0 },
  deployment: { configured: false, onChainOwnershipActive: false, metadataFrozen: false, independentlyAudited: false }
});

export const listGeekIdentities = () => Array.from({ length: geekCollectionBlueprint.supply }, (_, index) => identityForNumber(index + 1));

export const collectionManifest = () => ({ generatedFrom: 'server/geek-collection.js', blueprint: geekCollectionBlueprint, identities: listGeekIdentities() });

export const collectionPreview = () => ({ ...geekCollectionBlueprint, preview: [1, 25, 125, 250, 375, 450, 491, 498, 499, 500].map(identityForNumber) });

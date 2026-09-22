const TIERS = [
  { name: 'Common', count: 250 },
  { name: 'Rare', count: 125 },
  { name: 'Epic', count: 75 },
  { name: 'Legendary', count: 40 },
  { name: 'Elite', count: 8 },
  { name: 'Mythic', count: 2 }
];

const DISTRICTS = [
  { id: 'kaspa-core', name: 'Kaspa Core', discipline: 'BlockDAG literacy' },
  { id: 'arcade-foundry', name: 'Arcade Foundry', discipline: 'Video game systems' },
  { id: 'nebula-archive', name: 'Nebula Archive', discipline: 'Science fiction' },
  { id: 'tech-spire', name: 'Tech Spire', discipline: 'Technology' },
  { id: 'cinema-vault', name: 'Cinema Vault', discipline: 'Movies' },
  { id: 'history-relay', name: 'History Relay', discipline: 'History' },
  { id: 'comic-forge', name: 'Comic Forge', discipline: 'Comics' },
  { id: 'culture-circuit', name: 'Culture Circuit', discipline: 'Pop culture' }
];

const ARCHETYPES = ['Archivist', 'Builder', 'Cipher', 'Explorer', 'Guardian', 'Mentor', 'Operator', 'Scout', 'Tactician', 'Visionary'];

const tierForNumber = (number) => {
  let ceiling = 0;
  for (const tier of TIERS) {
    ceiling += tier.count;
    if (number <= ceiling) return tier.name;
  }
  return 'Mythic';
};

const identityForNumber = (number) => {
  const district = DISTRICTS[(number - 1) % DISTRICTS.length];
  const anchor = number === 499 ? { name: 'GIGA', role: 'Community Heart' } : number === 500 ? { name: 'A.C.E.', role: 'Protocol Mind' } : null;
  return {
    id: `geek-${String(number).padStart(3, '0')}`,
    number,
    name: anchor?.name || `${district.name} ${ARCHETYPES[(number - 1) % ARCHETYPES.length]} ${String(number).padStart(3, '0')}`,
    role: anchor?.role || ARCHETYPES[(number - 1) % ARCHETYPES.length],
    tier: tierForNumber(number),
    district: district.id,
    districtName: district.name,
    discipline: district.discipline,
    artStatus: anchor ? 'anchor-concept' : 'design-pending'
  };
};

export const geekCollectionBlueprint = Object.freeze({
  name: 'The Omniscient Grid',
  symbol: 'GEEK-500',
  supply: 500,
  chain: 'Kaspa-ready; deployment not configured',
  status: 'DESIGN BLUEPRINT',
  utility: 'Identity and cosmetic access only; no competitive advantage',
  anchors: [identityForNumber(499), identityForNumber(500)],
  tiers: TIERS.map((tier) => ({ ...tier })),
  districts: DISTRICTS.map((district) => ({ ...district }))
});

export const listGeekIdentities = () => Array.from({ length: geekCollectionBlueprint.supply }, (_, index) => identityForNumber(index + 1));

export const collectionPreview = () => ({
  ...geekCollectionBlueprint,
  preview: [1, 2, 3, 125, 250, 375, 450, 491, 499, 500].map(identityForNumber)
});

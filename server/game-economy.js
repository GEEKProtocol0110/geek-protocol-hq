// Current internal Alpha-credit rules. These do not authorize token settlement.
export const ROUND_CONFIG = Object.freeze([
  { round: 1, entry: 0, reward: 10, max: 100, label: 'INITIATION' },
  { round: 2, entry: 40, reward: 20, max: 200, label: 'BASIC PROTOCOLS' },
  { round: 3, entry: 100, reward: 40, max: 400, label: 'NETWORK LAYER' },
  { round: 4, entry: 200, reward: 80, max: 800, label: 'DATA STREAMS' },
  { round: 5, entry: 400, reward: 150, max: 1500, label: 'GRID ACCESS' },
  { round: 6, entry: 750, reward: 280, max: 2800, label: 'DEEP PROTOCOL' },
  { round: 7, entry: 1250, reward: 450, max: 4500, label: 'CIPHER DESCENT' },
  { round: 8, entry: 2000, reward: 700, max: 7000, label: 'CORE BREACH' },
  { round: 9, entry: 3500, reward: 1100, max: 11000, label: 'OMNISCIENT GATE' },
  { round: 10, entry: 6000, reward: 1800, max: 18000, label: 'APEX PROTOCOL' }
].map(round => Object.freeze(round)));

export const RANKED_START_IP_LIMIT = Object.freeze({ maximum: 20, seconds: 3600 });

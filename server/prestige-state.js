export const MAX_PRESTIGE = 25;
export const prestigeKeyFor = playerId => `geek:prestige:v1:${playerId}`;
export const initialPrestigeState = () => ({ version: 1, prestige: 0, xpBaseline: 0, history: [] });

export const validatePrestigeState = state => {
  if (!state || state.version !== 1 || !Number.isInteger(state.prestige) || state.prestige < 0 || state.prestige > MAX_PRESTIGE || !Number.isSafeInteger(state.xpBaseline) || state.xpBaseline < 0 || !Array.isArray(state.history) || state.history.length > MAX_PRESTIGE) throw new Error('PRESTIGE_STATE_INVALID');
  return state;
};

// Preserve ranks earned under the old automatic 25-level system, once.
export const migrateLegacyPrestige = profile => {
  const xp = Math.max(0, Math.floor(Number(profile.xp) || 0));
  const prestige = Math.min(MAX_PRESTIGE, Math.floor(xp / 6250));
  return { ...initialPrestigeState(), prestige, xpBaseline: prestige * 6250, legacyPrestige: prestige };
};

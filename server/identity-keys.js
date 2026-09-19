const safeScope = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);

export const identityEnvironment = () => safeScope(
  process.env.IDENTITY_ENV
  || (process.env.VERCEL_ENV === 'production' ? 'production' : process.env.VERCEL_ENV)
  || 'development'
) || 'development';

const prefix = () => `geek:${identityEnvironment()}:identity`;

export const identityPlayerKey = (playerId) => `${prefix()}:player:${playerId}`;
export const identityWalletKey = (addressHash) => `${prefix()}:wallet:${addressHash}`;
export const identityChallengeKey = (challengeId) => `${prefix()}:challenge:${challengeId}`;
export const identityAuthorizationKey = (tokenHash) => `${prefix()}:authorization:${tokenHash}`;

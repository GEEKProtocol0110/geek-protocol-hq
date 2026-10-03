export const economyPolicy = Object.freeze({
  id: 'platform-fees-70-30-v1', currency: 'GEEK', decimals: 8,
  scope: 'All eligible Geek platform fees; each transaction must state its fee portion.',
  recyclePercent: 70, burnPercent: 30,
  rounding: 'Recycle rounds down to the smallest token unit; burn pending receives the remainder.',
  transfersEnabled: false, purchasesEnabled: false, payoutsEnabled: false, burnsEnabled: false
});

export const powerups = Object.freeze([
  { id: 'fifty-fifty', name: '50/50', description: 'Reduce the choices by removing two incorrect answers.', rules: 'Try it free once per assisted practice session. Paid mode rules remain in development.', practice: { enabled: true, free: true, usesPerSession: 1, url: '/practice/' } },
  { id: 'ask-fandom', name: 'Ask the Fandom', description: 'See how other players answered.', rules: 'Requires real response statistics; no made-up poll results.' },
  { id: 'extra-time', name: 'Extra Time', description: 'Add time to think about the current question.', rules: 'Try a free 10-second boost once per assisted practice session. Paid mode rules remain in development.', practice: { enabled: true, free: true, usesPerSession: 1, extraSeconds: 10, url: '/practice/' } },
  { id: 'skip-question', name: 'Skip Question', description: 'Move past a question.', rules: 'Scoring, reward eligibility and use limits must be finalized.' },
  { id: 'safety-net', name: 'Safety Net', description: 'A proposed second chance after a mistake.', rules: 'The protected event and limits must be finalized.' },
  { id: 'double-geek', name: 'Double GEEK opportunity', description: 'A proposed opportunity to increase an eligible reward.', rules: 'Effect, funding and eligibility must be finalized; no reward is guaranteed.' }
].map(item => Object.freeze({ ...item, priceRaw: null, status: 'planned', purchasesEnabled: false, usageEnabled: false })));

export const treasuryAccounts = Object.freeze([
  ['reward-reserve', 'Reward Reserve', 'Funding for eligible player rewards.'],
  ['creator-pool', 'Creator Reward Pool', 'Funding for eligible contributor rewards.'],
  ['tournament-pool', 'Tournament Pool', 'Funding for approved event prizes.'],
  ['operations', 'Operations Treasury', 'Operating funds, tracked separately from rewards.'],
  ['burn-pending', 'Burn Pending', 'Amounts allocated for burning, awaiting verified execution.'],
  ['burn-confirmed', 'Burn Confirmed', 'Burns with validated on-chain evidence.'],
  ['withdrawal-wallet', 'Withdrawal Hot Wallet', 'A limited payout balance under controlled signing.'],
  ['emergency-reserve', 'Emergency Reserve', 'A separate reserve for recovery and interruptions.']
].map(([id, name, purpose]) => Object.freeze({ id, name, purpose, fundingVerified: false })));

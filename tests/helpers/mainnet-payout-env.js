// Test-only payout sender. Import this first so it is set before workers/mainnet/schedule.mjs
// reads MAINNET_PAYOUT_ADDRESS. The address is derived from the public test key 0x…04 and is
// not a real wallet. Production also requires the reviewed digest, which this value does not have.
export const TEST_MAINNET_PAYOUT_ADDRESS = 'kaspa:qrjf8kl3cyxcpu6creysfyctzszvcmqnjq8wqavywnaff2lgcnx3xcldmts00';
process.env.MAINNET_PAYOUT_ADDRESS = TEST_MAINNET_PAYOUT_ADDRESS;

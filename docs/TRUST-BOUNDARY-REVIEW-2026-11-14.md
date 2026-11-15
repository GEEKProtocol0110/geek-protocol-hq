# Account access and payout trust-boundary review

November 14, 2026 (Detroit). AUTH-005. Internal source review against main `142f104419ea16dab6b1762b77ffd7cae2ed6fdb`, followed by the focused patch described here. This is not an independent penetration test, a Kaspa consensus audit or an assessment of production account records.

## Separate the layers

| Layer | Boundary in this review | What this establishes |
| --- | --- | --- |
| Kaspa | Underlying network, consensus and transaction inclusion | No consensus or network-partition guarantee is established by reviewing HQ. |
| GEEK KRC-20 | Indexed token operations, deployment identity and future transfer verification | HQ depends on external indexer observations and validates the expected asset. A token ticker or a cloud receipt alone is not settlement evidence. |
| Geek HQ | Hosted application, Redis records, account proofs and payout admission | These are application controls operated by the project. A hash or HMAC does not make the application database decentralized or independently immutable. |

An external framework's numerical grade does not replace an identified code path, a reproducible failure and a bounded verification result. This review makes no claim about how the external tool generated its report.

## Reproduced availability finding: status reads could block sign-in

In the baseline, GET `/api/passkeys` and every POST action spent the same 30-request/session and 60-request/client allowance over 600 seconds. The home/account status client uses this endpoint. Thirty status reads in a valid guest session were sufficient to reject the next `begin-login` with HTTP 429, before any authenticator proof. Multiple sessions on one client also shared the client allowance. This can interrupt account access; it is not evidence of account takeover or the cause of a particular missing-passkey prompt.

The new real-Redis regression failed against that baseline at the `begin-login` assertion (429 instead of 200). With the patch, those reads are followed by a complete P-256 WebAuthn login that restores the original player.

The patch classifies only by HTTP method. GET status has a separate bounded allowance of 240/session and 600/client per 600 seconds. Every POST, including device status/list actions and unknown or read-sounding action names, keeps the original 30/session and 60/client counters and expiry. Existing action throttles therefore survive rollout; no body field selects the read allowance. Status exhaustion cannot consume proof allowance, and action exhaustion cannot consume status allowance. Origin checks, required sessions, proof verification, challenge expiry, session rotation and management authorization are unchanged. All responses keep the existing no-store policy.

The allowance is an availability choice, not a capacity benchmark. Client fingerprinting retains its existing limitations. This patch does not introduce automatic polling or remove device-action limits; the current device client checks approval only on an explicit click.

## Controls inspected and limits

- **Player proof:** `server/passkeys.js` verifies exact configured origin/RP, user verification, single-use five-minute session/player-bound challenges, credential signatures/counters and atomic session rotation. `server/session.js` checks account epoch and wallet version. Tests cover replay, wrong account/origin, revoked sessions and concurrent changes. Preview and production have separate RP contexts; no credential/account migration is performed here.
- **Trusted devices:** `server/device-access.js` binds the request to its receiving session and exact origin, requires a fresh one-use approving passkey grant and explicit confirmation, and consumes approvals atomically. The receiving session gains no management grant. Real phone/Silk acceptance remains separate from synthetic tests.
- **Owner access:** `server/operations-access.js` and the MFA controls bind owner sessions to configuration and reject direct role-header bypasses when MFA is configured. TOTP activation is optional and requires private enrollment. This review neither inspected production secret values nor established live enrollment, provider MFA or an independent second administrator. See [owner enrollment](OPERATOR-SECURITY.md).
- **Payout admission/signing:** `server/mainnet-payout.js`, `workers/mainnet/eligibility.mjs` and `workers/mainnet/job-mac.mjs` retain the released CHAIN-007 boundary: saved private-bank/live-season proof, exact v2 MAC-bound proof fields and fail-closed worker/signer checks. The current public loader provides no qualifying private context. Existing tests exercise forged client fields, public runs, caps, replay, journal recovery and offline signer rejection. A hash-shaped bank version alone does not establish private-bank review or anti-cheat quality.

## Remaining gates

Keep the private-bank production cutover, live-season/anti-cheat acceptance, independent application and treasury/signing review, owner/provider recovery and physical-device account acceptance as separate evidence. The deployed Preview integration is not production private-bank acceptance. CCE economics, settlement and collection ownership holds remain. No environment value, credential, treasury key, signing service or economic setting changes in this patch.

## Verification and release

The regression uses an isolated loopback Redis fixture, synthetic accounts and cryptographic credentials; no production account or credential is used. Full `npm run verify` passed: 924 application tests, nine testnet signer checks and six mainnet signer checks (939 total), zero failures/skips, plus bank, archive, collection, security, repository, economy, continuity, site and whitepaper checks. The PR review record identifies the final checked source, merge and deployment separately. Source references: `api/passkeys.js`, `tests/passkeys.test.js`, [passkey protocol](PASSKEY-LOGIN.md), [trusted devices](TRUSTED-DEVICE-ACCESS.md), [payout controls](MAINNET-GEEK-PAYOUT.md).

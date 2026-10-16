# First-visit polish and reliability

Task: UX-001. October 16, 2026. Candidate branch: `codex/new-player-polish`, based on main `26b97263c36b63abe09028b536e838bd5bcc1f86`.

## Behavior

- Home offers the existing five-step welcome route. Sign-in shows the current saved name, a returning-passkey action, a separate save-current-player disclosure, and optional recovery management. Wallet instructions are collapsed until requested; explicit wallet authorization opens the exact-message flow. Success and the allowlisted destination are above the wallet section. Switching-player/non-merge and recovery limitations remain visible or available beside the action.
- My HQ correctly labels passkey-only protection and starts with a loading name rather than a fabricated guest identity. Completed Quest copy uses the actual chapter count. Leaderboards resolve the durable public name without rewriting scores or score timestamps.
- A reproduced session race allowed a refresh that read an earlier guest snapshot to overwrite freshly verified wallet protection. An atomic Lua compare-and-set now saves the session and name together against the exact validated snapshot. Newer session state yields 409 with a saved-state/reload instruction; a deleted session yields 401 and no new cookie. A failed precondition cannot partially rename a player. This strengthens the earlier update-only guard from PR #125.
- Redis HTTP requests, including response-body reads, have an eight-second deadline. The transport does not retry uncertain writes. Network/provider failures return a stable service-unavailable message without provider details. Reload and inspect saved state before repeating a write whose response was lost. Sequential calls can still make an API operation exceed one transport deadline; this is not an overall API latency guarantee.
- Security explains the actual boundary: hosted Alpha learning/account services, Kaspa token operations, device-managed passkey verification, and disabled reward/DeFi settlement. No zero-bug, completed-audit or fully decentralized learning claim.

## Evidence

The stale-refresh regression failed on the prior implementation (`identityVersion` became 0 instead of 1), then passed with the atomic save. Shipped API/client tests cover preserved wallet protection, revoked-session/name atomicity, renamed leaderboard score/time, guest/wallet/passkey badges, current name, timeout before headers or during JSON, no write retry, and cleared deadlines. Synthetic client DOM tests are not physical-phone or rendering evidence.

Local `npm run verify` passed: 479 tests, zero failures/skips, required real Redis 7.4.2, 311 security assertions, bank/catalog/readiness, collection/archive, repository, economy and continuity checks. Production dependency audit returned zero vulnerabilities. Outage regression expectations now assert stable 503/REDIS_UNAVAILABLE responses while retaining saved-state and one-write recovery assertions. Exact review/deployment identifiers are recorded in the pull request and continuity work log. This candidate is not deployed until those checks complete.

## Remaining work

Independent authentication/security review, a production-provider restore exercise, an off-provider backup and successor access remain separate work. The founder's earlier phone success remains accepted; returning sign-in, cross-device recovery and revocation acceptance are not inferred from that report. Draft #119 must be reconciled with shipped authentication before feature work resumes. Artwork PR #120 remains paused. CCE bank/economy, contributor-rate, settlement and collection-ownership holds remain closed.

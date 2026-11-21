# First recovery-wallet linking — AUTH-006

November 17, 2026. Source candidate based on main `b7521c6db2087d0c40580afa443104f33f4cd212`. Not merged, deployed or independently accepted.

## Scope and behavior

A passkey-only account must freshly confirm account access before adding its first recovery wallet. On Sign in, open **Manage saved access**, choose **Verify with a passkey**, then explicitly request the wallet message below. Both browser-wallet and manual-message clients carry the one-use grant in memory. A failed challenge does not trigger signing or an automatic write retry. Other pages direct the player to Sign in when confirmation is needed.

A first-link challenge records the credential-set hash and fresh-proof deadline. At commit, the exact passkey account and the requester-session snapshot validated on entry must still match. The identity, existing passkeys' wallet version, session and audit event commit in one Redis script. Credential IDs, public keys, counters, epoch, stable player and progress are preserved. The original fresh-proof expiry is not extended by requesting a later wallet challenge. Wallet recovery still invalidates prior passkeys and requires explicit re-enrollment.

No live account, wallet link, payout, provider configuration or production secret is changed by this work. This is an internal source/test review, not an independent audit. Claude's full named report was unavailable in the connected files at review time; the founder's pasted summary supplied the finding, which was independently reproduced against the source.

## Regression evidence

`tests/passkeys.test.js` runs shipped handlers with real isolated Redis and cryptographic WebAuthn/Kaspa proofs. It covers:

- Session-only first-link refusal and subsequent owner passkey login.
- Authorized first linking preserving two independently usable credentials, player ID and exact saved profile bytes.
- Wrong-session, expired and reused grants; consumed wallet challenges.
- A guest challenge issued before passkey enrollment, including an already validated in-flight requester.
- Changed account and revoked session immediately before atomic commit, without a partial wallet mapping or session resurrection.
- Proof expiry after challenge creation and parallel submission with exactly one winner.

Client behavior tests execute both shipped wallet request paths: a fresh grant is sent once, no background signature starts, and rejection never submits a wallet signature. These synthetic clients do not establish rendering or physical-wallet acceptance.

Local verification passed: 973 application tests plus nine Testnet and six Mainnet offline signer checks (988 total), zero failures/skips; 325 security assertions and all question, collection, archive, repository, economy, continuity, site and whitepaper checks passed. Required real Redis was used for the application suite. All seven new security regressions fail on unchanged main with the same new tests, then pass on this candidate. Exact source and hosted CI references are recorded in the PR and continuity worklog.

## Release and follow-ups

Keep this as a draft for independent review and founder release review. Resolve continuity-file conflicts with other security candidates and run verification on the resulting head. After any separately authorized merge, confirm an actual passkey-only account can authorize its own wallet and return with its original passkey; record deployment and physical-device acceptance separately.

Session-ID rotation on wallet proof/recovery remains open. Device approval phishing, the legacy payout-preference route's passkey-only reauthorization, and Redis empty-array trade serialization require separate scoped tests/fixes. The newer receiving-address service already has fresh-proof tests; it does not prove the legacy route safe. Repeated first-round reward eligibility, private ranked-bank cutover and payout-review admission remain pre-settlement gates. No economic hold is lifted.


## November 21 integration review

Integrated current main `7db37b3459ef80ef0ec05635c39a81ca0f049da1` into the existing #309 branch without rewriting its history. Resolved only maintained-record conflicts, preserving the Credits Song, directory updates, account deletion and every earlier worklog entry. Runtime auto-merges retain account deletion's session tombstone check and controls.

Added two real-Redis cryptographic integration regressions: a preserved passkey must freshly authorize deletion after linking, and deletion on another device during the link's atomic commit must not recreate wallet identity or bindings. Both pass. The initial new deletion test asserted HTTP 401 for a removed credential; the route's established `PASSKEY_PROOF_INVALID` response is HTTP 400. The assertion now checks the refusal code and absence of a signed-in result. No runtime behavior was changed to satisfy it.

Validation on the integrated runtime: `npm test -- --test-concurrency=2` with `DUEL_REQUIRE_REDIS=1`, `QUEST_REQUIRE_REDIS=1` and isolated Redis 7.2.5 passes **983 application tests**, zero failures/skips. Both offline signer suites pass **9 each** (18), for **1,001 tests total**. Every remaining component of `verify` passes, including **333 security assertions** and continuity, site and whitepaper checks. Redis was built from upstream tag 7.2.5 (`f60370ce28b946c1146dcea77c9c399d39601aaa`) in temporary scratch, with persistence disabled by the fixture. The environment rejects the Node test concurrency option in NODE_OPTIONS, so the application suite and the remaining verify components were run separately.

These are local integration results. Geek Bot's November 20 report states Security Bot cleared the earlier #309 head; no submitted GitHub review exists on #309 as of this check. That report does not cover the refreshed head or substitute for independent review. Inspect refreshed hosted checks before release; production and physical-wallet/device acceptance are not established here. See the dated security queue for remaining work.

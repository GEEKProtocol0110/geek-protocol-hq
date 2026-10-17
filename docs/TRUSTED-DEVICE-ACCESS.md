# Trusted-device account access

AUTH-003 — implemented candidate, October 17, 2026. Actual Fire/Silk acceptance and independent security review remain pending.

## What this does

A player with a saved Geek passkey on a trusted phone can approve a guest browser on a nearby tablet for the same player. The receiving browser needs HTTPS, JavaScript and cookies, but no local WebAuthn provider. This shares the player's profile, learning history and gameplay access. It does not create a separate child account or parent/child roles. Do not approve a parent's account expecting a separate child's profile.

1. Open **Sign in → Approve another device → On the tablet**. Acknowledge that its separate guest progress will not merge and may become inaccessible after switching. Name the tablet and show its approval code.
2. On the trusted phone, open the same site origin (use the same www address), sign in with the saved Geek passkey if needed, and enter that code under **On the phone**.
3. Compare the matching check and device label on both screens. The phone names the player being approved. Confirm that the device beside you is yours. Never approve a code sent in a message or presented by purported support.
4. Sign in with the passkey again for fresh proof, then approve the reviewed device. Approval fails if a different player was selected during that sign-in.
5. On the tablet choose **Check approval**, verify the approved player name, then explicitly switch. Pending requests never automatically switch a player. Keep this page open; the request is not saved in browser storage or a URL.
6. On a supported device, use **Manage approved devices** to list and remove access. Each removal needs a fresh passkey sign-in. At most ten approved browsers are recorded; remove old entries before adding more.

The phone remains signed in. The tablet receives an ordinary 30-day HttpOnly/Secure/SameSite=Lax cookie; normal active-session refresh behavior applies. Clearing cookies or signing out requires a new approval or another saved login method. In-progress ranked runs and lobby seats are session-bound and are not transferred. Old guest profile records are preserved separately; this feature provides no guest-profile merge or recovery handle.

## Protocol and security boundaries

The existing `/api/passkeys` handler handles `device-*` actions with the existing exact-origin, valid-session, no-store and client/session rate limits (30/session and 60/client per ten minutes). There is no new public API function or WASM packaging requirement.

A 96-bit random code indexes a SHA-256 request key. A separate random matching check aids side-by-side confirmation. Only one request is current for a receiving session; creating another invalidates its predecessor. Requests expire in five minutes, are bound to the exact origin and receiving session/player, and require explicit guest-progress acknowledgement. A code alone does not grant access. Only its original session can inspect approval, cancel or complete it. Names and device labels are untrusted text and never authentication identifiers.

The approving device must have a currently valid passkey-protected session, a fresh five-minute single-use proof grant, the reviewed player ID and matching check, and explicit confirmation. Wallet-only users can enroll a passkey through the existing fresh-wallet-proof path on a supported device; wallet-only direct approval is not added. Approval captures the exact current passkey account and wallet protection snapshots. Consumption rechecks those snapshots, the requesting session, current request pointer, approving session existence, device index and unused replacement session ID in one Lua compare-and-set. Signing out the approving browser before completion or changing account protection invalidates the pending approval. Successful completion atomically stores the replacement session/device index/audit, consumes the request and deletes the tablet's old cookie record. Parallel completions have one winner. No write is automatically retried after uncertainty.

The receiving device inherits account epoch/wallet-version validation, but receives **no fresh management grant**. Adding/removing passkeys or approving/removing devices still requires fresh cryptographic proof. Protected payout changes keep their existing wallet proof. Scores, Daily limits, rewards, CCE, Mainnet settlement and ownership gates are unchanged.

Device lists expose random public device IDs, labels and creation times; bearer session IDs remain server-only. Removal atomically deletes the recorded session and updates the index/audit against exact protection/session/index snapshots. Existing session refresh compare-and-set cannot resurrect that deleted cookie. A subsequent independent passkey sign-in is separately authorized and is not revoked by deleting an old approved cookie. Expired/signed-out entries can remain in the bounded list until removed.

`geek:device:request:v1:*`, `geek:device:pending:v1:*` and `geek:device:list:v1:*` contain transient approvals/bearer-session references. Offline restored-session cleanup deletes the entire reserved `geek:device:*` namespace along with all sessions/grants/challenges, preserving durable passkey credentials and player progress. Never introduce durable player content under that namespace. Audit records contain action names and hashed identifiers, not approval codes, matching checks, signatures or bearer cookies.

## Threat model and evidence limits

Checks cover real P-256 WebAuthn proofs and real Redis Lua behavior; client tests execute the shipped JavaScript with a synthetic DOM. They cover exact origin/session binding, fresh proof and replay, wrong-player/check/confirmation rejection, guest acknowledgement, replacement/cancellation/expiry, profile preservation, concurrent completion, malformed indexes, revocation versus stale refresh, restore cleanup, unsupported-WebAuthn initialization, explicit receiving confirmation and bounded requests without automatic write retries.

A trusted-device flow still relies on the user verifying the nearby device and refusing remote approval requests. The check is not a distance/proximity proof. Database compromise, a compromised browser/OS, stolen active cookies and social engineering are outside the cryptographic protection provided here. This is a custom same-site session delegation flow, not an implementation or certification of OAuth Device Authorization Grant. Its code entropy, expiry, confirmation and phishing boundaries were reviewed against the primary [RFC 8628 security considerations](https://www.rfc-editor.org/rfc/rfc8628.html#section-5).

Source tests do not establish installed Fire OS/Silk behavior, a real two-device acceptance, a provider restore or independent review. Preserve the founder's separate October 16 successful phone-passkey report and October 17 failed Silk-enrollment report. Validate this alternate login with that actual tablet before calling the device issue resolved. Family roles and email recovery remain separate planned work; no model service, signer or wallet transfer is installed by this change.

# Wallet Identity Protocol

Version: 1.1
Status: implemented Alpha control; independent review not completed

## Purpose and non-purpose

This protocol lets a player prove control of one Kaspa mainnet wallet, recover the same Geek Protocol player record in another browser, and reauthorize a protected payout-setting change. It does not request a transaction, authorize a transfer, enable a withdrawal, or prove ownership of a different payout destination.

The private key remains inside the wallet. The server stores the normalized public key and derived address but never stores the proof signature.

## Cryptographic profile

| Property | Value |
|---|---|
| Network | Kaspa mainnet |
| Signature | BIP-340 Schnorr personal-message signature |
| Signature request | Wallet-independent KIP-5 proof; Kasware explicit Schnorr, Kaspire Extension, discovered providers, or pasted signature |
| Server verifier | pinned `@dfns/kaspa-wasm` `0.14.1` |
| Public key | compressed secp256k1 or 32-byte x-only hex; optional in challenge requests because single-key addresses encode it |
| Accepted signature encoding | 64-byte signature as 128 hexadecimal characters or canonical Base64 |
| Address check | checksum and SDK address validation; Schnorr addresses must equal the SDK-derived address; ECDSA-format addresses must embed the exact full compressed key |
| Challenge entropy | independent 256-bit random nonce plus a 160-bit random challenge identifier |
| Challenge lifetime | five minutes |

Dependency origin, lock integrity, and reviewed module hashes are recorded in `docs/DEPENDENCY-PROVENANCE.md`.

## Signed message

The server creates all fields. The browser signs the exact returned text without editing it.

```text
GEEK Protocol Identity Proof
Version: 1
Origin: <canonical origin>
Action: <link, recover, authorize payout destination, or authorize payout removal>
Identity wallet: <Kaspa mainnet address>
Requested payout: <destination, only for payout-set>
Challenge: <256-bit nonce>
Issued: <ISO-8601 timestamp>
Expires: <ISO-8601 timestamp>
This proves wallet control only. It does not authorize a transaction, transfer, purchase, mint, or withdrawal.
```

The exact requesting HTTPS origin, action, identity wallet, requested destination where applicable, nonce, issue time, and expiry are therefore inside the signed payload. Geek Protocol re-derives and compares that origin when the proof is submitted. A challenge created on `www.geekprotocol.xyz` is rejected on `geekprotocol.xyz`, and vice versa.

## State transitions

1. The player explicitly connects a browser wallet or submits a Kaspa address to create a message.
2. The server validates the single-key Kaspa Mainnet address and its embedded public key. An optional provider key must match the address.
3. The server stores a one-time challenge for five minutes and returns only its identifier, exact message, scheme, and expiry.
4. The wallet signs the exact message in explicit Schnorr mode.
5. The server atomically consumes the challenge with `GETDEL`, rechecks the exact requesting origin, and then checks the signature. A failed origin or signature check consumes the challenge as well.
6. After a valid signature, a Redis compare-and-set script verifies the expected wallet and player state and atomically writes the wallet mapping, player identity, replacement browser session, and successful audit event.
7. A recovery increments the identity session version. Every linked session is checked against that current version on each authenticated request, so older sessions fail closed.

The atomic binding step prevents a raced or interrupted request from leaving a second wallet partially attached to a player. A stale compare-and-set returns a conflict and requires a new challenge.

## Wallet transports and compatibility

Kasware is one signing transport, not the identity namespace. The same address maps to the same player regardless of how its valid proof arrives. Address-only challenge creation grants no identity access; verification still needs the one-time KIP-5 signature.

- **Manual message:** the user pastes a Mainnet address, copies the exact server message into their wallet's Kaspa message-signing feature, and submits hexadecimal or canonical Base64 signature. The browser clears the challenge on address edits, expiry, or attempted verification, bounds requests to 15 seconds, and never retries a write automatically. No public-key field, seed, or private key is needed.
- **Kasware:** keeps the existing explicit Schnorr request. An unavailable token-balance read does not block identity verification.
- **Kaspire Extension:** uses `window.kaspire.request` with `requestAccounts`, `getNetwork`, `getPublicKey` and `{ method: 'signMessage', params: { address, message } }`; verifies the returned address matches the selected one. Supports its documented x-only public key.
- **Announced providers:** listens for `kaspa:provider` and requests replay with `kaspa:requestProvider`, following the companion KIP-12 draft interface. Capabilities are checked and a maximum of 20 candidates are displayed. Labels use text only; provider icons and remote metadata are never loaded. This draft transport is not a claim that all wallets implement it.

No account access or signing occurs on page load. Users explicitly select and connect a browser provider. Announced names are untrusted display hints; all ownership authority remains with the server-verified signature. Mainnet aliases normalize; wrong/unknown network blocks browser signing. An account change before submitting a signature aborts that attempt.

Single-key Schnorr and ECDSA-format Kaspa addresses are accepted **only with KIP-5 Schnorr message proofs**. ECDSA address acceptance does not add ECDSA-message verification or establish Tangem compatibility. Existing compressed-key records remain compatible with x-only proofs, without replacing the stable player or weakening payout reauthorization. Shared-script/multisig addresses need a separate reviewed proof and receive an actionable unsupported response. An exchange deposit address cannot be treated as an individual's verified identity merely because it is copied.

A wallet without Kaspa message signing cannot authenticate through these paths. Keep the guest path visible. Mobile WalletConnect, installed-wallet acceptance (including Tangem/Kaspium), script-based ownership, and a separately reviewed alternative login method remain pending. Do not ask users to export or reimport keys to work around unsupported wallet features. Manual signatures currently cover identity login/recovery; protected payout editing still uses an explicitly connected signing provider.

Primary transport references (checked October 8, 2026): [KIP-5](https://github.com/kaspanet/kips/blob/master/kip-0005.md), [Kaspire Extension provider v1](https://kaspire.kaslab.space/developers/extension), and [Kaspa Wallet Standard companion v0.2 / KIP-12 draft](https://github.com/kaspa-wallet-standard/kaspa-wallet-standard/blob/main/SPEC.md).

## Protected payout changes

After identity is linked, payout-set and payout-remove operations require another signature. The challenge is scoped to the operation and, for a set operation, the exact normalized destination. A valid proof creates a random authorization token that:

- expires after five minutes;
- is stored only as a SHA-256 digest lookup key;
- is bound to the browser session, stable player ID, current identity version, operation, and destination hash; and
- is atomically consumed once before the payout preference changes.

The preference remains ineligible for settlement. `ownershipVerified` is true only when the chosen payout destination equals the verified identity wallet.

## Recovery boundary

Home and My HQ expose `/sign-in/`: choose a browser wallet or paste a Kaspa address, sign the existing one-time identity challenge, then open My HQ. Connecting alone is not authentication. Existing verified sessions can continue without another signature; missing-wallet and wrong-network states explain the next step. This flow uses the existing Mainnet proof and requests no transaction.

My HQ exposes **Edit profile name** on the identity card. An explicit `POST /api/session` with `action: "rename"` requires a valid current session, validates a 1–24-character name, and applies rate limits before writing. Names are stored at `geek:player-name:<stable-player-id>` separately from game profiles; stale score/profile writes cannot undo edits. Session reads resolve that durable name, including after wallet recovery. Existing sessions seed a missing name with `SET NX`; automatic refresh cannot replace a chosen name. Display names are public labels, not unique login identifiers. The legacy explicit lobby editor writes the same name record.

Recovery restores the persistent player ID and its profile, XP, level, prestige, bounded journey history, Alpha balance, leaderboard identity, C.C.E. contribution history, and payout preference. It does not restore an in-progress ranked run or lobby seat, which remain bound to an ephemeral browser session.

The current Alpha supports one immutable recovery wallet per player. Payout-setting mutations now create persistent in-product notices, but out-of-band email or mobile alerts, wallet rotation, social recovery, and administrative recovery remain deliberately absent pending separate design and review.

## Evidence and negative tests

`tests/api.test.js` covers valid link, exact-origin mismatch rejection, challenge replay rejection, unrelated-wallet rejection without orphaned binding, fresh payout authorization, authorization replay rejection, invalid recovery signature, successful recovery, older-session invalidation, profile restoration, and protected payout removal.

`scripts/security-check.mjs` verifies that the release still contains server-side signature verification, mainnet public-key/address derivation, random short-lived single-use challenges, atomic identity binding, fresh payout authorization, and no client-side signature-verification trust decision.

## Residual review items

- Independently reproduce wallet compatibility and signature test vectors across supported wallet builds.
- Fuzz hexadecimal and Base64 signature parsing, public-key parsing, address normalization, and message Unicode handling.
- Test parallel link, recovery, payout authorization, session-fixation, Redis interruption, and replay scenarios against production-equivalent infrastructure.
- Define a separately reviewed wallet-rotation policy and out-of-band notification channel.
- Repeat this review for every added wallet provider or signature scheme.

These open items are launch gates. They do not enable or justify on-chain settlement.

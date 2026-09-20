# Wallet Identity Protocol

Version: 1.0
Status: implemented Alpha control; independent review not completed

## Purpose and non-purpose

This protocol lets a player prove control of one Kaspa mainnet wallet, recover the same Geek Protocol player record in another browser, and reauthorize a protected payout-setting change. It does not request a transaction, authorize a transfer, enable a withdrawal, or prove ownership of a different payout destination.

The private key remains inside the wallet. The server stores the normalized public key and derived address but never stores the proof signature.

## Cryptographic profile

| Property | Value |
|---|---|
| Network | Kaspa mainnet |
| Signature | BIP-340 Schnorr personal-message signature |
| Signature request | Kasware `signMessage(message, { type: 'schnorr' })` |
| Server verifier | pinned `@dfns/kaspa-wasm` `0.14.1` |
| Public key | compressed secp256k1, 33 bytes encoded as 66 lowercase hexadecimal characters |
| Accepted signature encoding | 64-byte signature as 128 hexadecimal characters or canonical Base64 |
| Address check | server derives a Kaspa mainnet address from the public key and requires exact normalized equality |
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

1. The player explicitly connects a wallet and asks to verify it.
2. The server validates the public key and derives the submitted Kaspa mainnet address.
3. The server stores a one-time challenge for five minutes and returns only its identifier, exact message, scheme, and expiry.
4. The wallet signs the exact message in explicit Schnorr mode.
5. The server atomically consumes the challenge with `GETDEL`, rechecks the exact requesting origin, and then checks the signature. A failed origin or signature check consumes the challenge as well.
6. After a valid signature, a Redis compare-and-set script verifies the expected wallet and player state and atomically writes the wallet mapping, player identity, replacement browser session, and successful audit event.
7. A recovery increments the identity session version. Every linked session is checked against that current version on each authenticated request, so older sessions fail closed.

The atomic binding step prevents a raced or interrupted request from leaving a second wallet partially attached to a player. A stale compare-and-set returns a conflict and requires a new challenge.

## Protected payout changes

After identity is linked, payout-set and payout-remove operations require another signature. The challenge is scoped to the operation and, for a set operation, the exact normalized destination. A valid proof creates a random authorization token that:

- expires after five minutes;
- is stored only as a SHA-256 digest lookup key;
- is bound to the browser session, stable player ID, current identity version, operation, and destination hash; and
- is atomically consumed once before the payout preference changes.

The preference remains ineligible for settlement. `ownershipVerified` is true only when the chosen payout destination equals the verified identity wallet.

## Recovery boundary

Recovery restores the persistent player ID and its profile, XP, Alpha balance, leaderboard identity, C.C.E. contribution history, and payout preference. It does not restore an in-progress ranked run or lobby seat, which remain bound to an ephemeral browser session.

The current Alpha supports one immutable recovery wallet per player. Payout-setting mutations now create persistent in-product notices, but out-of-band email or mobile alerts, wallet rotation, social recovery, and administrative recovery remain deliberately absent pending separate design and review.

## Evidence and negative tests

`tests/api.test.js` covers valid link, exact-origin mismatch rejection, challenge replay rejection, unrelated-wallet rejection without orphaned binding, fresh payout authorization, authorization replay rejection, invalid recovery signature, successful recovery, older-session invalidation, profile restoration, and protected payout removal.

`scripts/security-check.mjs` verifies that the release still contains server-side signature verification, mainnet public-key/address derivation, random short-lived single-use challenges, atomic identity binding, fresh payout authorization, and no client-side signature-verification trust decision.

## Residual review items

- Independently reproduce wallet compatibility and signature test vectors across supported Kasware versions.
- Fuzz hexadecimal and Base64 signature parsing, public-key parsing, address normalization, and message Unicode handling.
- Test parallel link, recovery, payout authorization, session-fixation, Redis interruption, and replay scenarios against production-equivalent infrastructure.
- Define a separately reviewed wallet-rotation policy and out-of-band notification channel.
- Repeat this review for every added wallet provider or signature scheme.

These open items are launch gates. They do not enable or justify on-chain settlement.

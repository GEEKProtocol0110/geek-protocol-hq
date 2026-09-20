# Payout Change Notices and Risk Review

Version: 1.0  
Status: implemented Alpha control; configuration and independent review required

## Boundary

The rewards page stores a preferred Kaspa mainnet receiving address for possible future use. The separate public mint page can request one user-approved, non-custodial mint through Kasware, but no server code in this repository can sign, transfer, withdraw, or settle GEEK for a player. A review approval is evidence only: it never changes `settlementEligible: false` or `withdrawalsEnabled: false`.

## Player notice

Every destination create, change, reaffirmation, or removal stores a notice in the player's server profile. The notice includes a random reference, timestamp, payout-setting version, masked previous and current addresses, risk-review state, and plain-language confirmation that no transfer occurred. Raw prior addresses are not copied into the notice.

Because the notice lives with the stable player profile, wallet recovery restores it on another browser. This is an in-product control, not an email, SMS, push, or wallet notification.

## Review triggers

A new destination enters the private review queue when one or more of these conditions apply:

- no recoverable identity wallet is linked;
- the destination differs from the verified identity wallet, so ownership is unverified;
- an existing destination changes;
- the identity was recovered during the previous seven days; or
- at least three payout-setting mutations occurred within thirty days.

Reaffirming the same destination preserves any existing review state. Removing a destination closes its pending review because removal is risk-reducing. A newer destination supersedes the older pending review.

These triggers are conservative Alpha policy, not a fraud score and not proof of wrongdoing. An independent reviewer should tune them with production abuse data before value moves.

## Private reviewer API

`GET /api/payout-review` lists up to 100 pending reviews. `POST /api/payout-review` accepts an `approve` or `reject` decision plus an eight-character minimum note. Both require a timing-safe comparison against the separate `PAYOUT_REVIEW_ADMIN_TOKEN` credential and are rate-limited.

The reviewer response excludes the stable player ID, raw destination, and destination hash. It contains a random review reference, masked address, reasons, payout-setting version, timestamps, status, and the immutable settlement-disabled flag.

Before accepting a decision, the server checks that the player profile still points to the same review, payout-setting version, and destination hash. A stale review is marked `superseded` instead of approved or rejected. Every decision and authorization failure creates pseudonymous audit evidence.

## Residual launch gates

- Configure the reviewer role with a unique production secret and hardware-backed individual access; never reuse moderation or audit-export credentials.
- Add out-of-band player alerts once a verified delivery channel and privacy policy exist.
- Define evidence requirements for ownership-unverified destinations while preserving wallet neutrality.
- Test concurrent destination changes and reviewer decisions against production-equivalent Redis.
- Replicate audit events to separately administered append-only storage and alert on queue or integrity failures.
- Independently test this control and retest any Critical or High findings before settlement.

# GEEK-500 character and artwork structure

## Founder clarification — October 15, 2026

Michael clarified: “So you see the direction I went with the 500 geek. 2500 different images.”

**500 Geek character concepts × five rarity artworks per concept = 2,500 planned distinct images.** Every concept is intended to have Common, Rare, Epic, Legendary and Mythic versions. The supplied Sci-Fi, A.I., Pro Gamer and Retro Gamer sets demonstrate this visual progression. This supersedes the earlier interpretation of 500 total editions in DR-005; DR-012 records the correction without deleting that history.

## Keep the counts distinct

| Count | Meaning | Evidence/state |
| --- | --- | --- |
| 500 | Planned character concepts | Founder direction; canonical names/IDs require reconciliation |
| 5 | Artwork tiers per concept | Common, Rare, Epic, Legendary, Mythic |
| 2,500 | Planned distinct artworks | 500 × 5; does not claim finished art exists |
| 4 | Complete five-tier sets supplied in this upload sequence | Sci-Fi, A.I., Pro Gamer, Retro Gamer |
| 20 | Original PNGs in those supplied sets | Exact file hashes and paths in the set indices |
| Unselected | Collectible copies per artwork and aggregate mint supply | Separate supply, allocation and deployment design |

[The set inventory](continuity/founding/character-art-sets.json) links every received set and its exact-byte record. The older AI Common with a robot companion remains an additional variant, not a replacement for the new Common. The ten-concept legacy archive stays separate; it is not silently counted toward complete-set coverage.

## Reconciliation work

The historical phone roster has 500 ordered positions, 482 exact distinct labels and 18 repeated-label pairs. The trait PDF is incomplete and its per-row quantities remain historical evidence, not approved mint counts. Sci-Fi, Pro Gamer and Retro Gamer match source-252, source-002 and source-001 respectively; A.I. Geek has no exact label match in those extracts. Resolve duplicates and stable character IDs without rewriting original source bytes.

The generated `server/geek-collection.js` / `public/data/geek-500.json` baseline still implements the earlier 500-slot interpretation with GIGA/A.C.E. anchors. It is preserved for compatibility in this archive change and is **not the completed implementation of the clarified 2,500-artwork plan**. COLL-001 must define a versioned character-plus-tier model, reconcile anchors and existing IDs, and update public explorer counts/metadata/tests before claiming that implementation. Do not silently renumber existing slots or equate artwork count with minted supply.

Acquisition directions (mint, earned rewards, GEEK/KAS purchases) remain planned. Copies per artwork, prices, allocation and acquisition rules are unfinished. Existing art approvals, ownership, minting, settlement and CCE holds remain in force. Cosmetic rarity does not grant scoring or payout advantages.

## Original art and production

Uploaded originals remain unchanged, including square and portrait dimensions and original filenames. Delivery-size images, thumbnails and avatar crops are future derivatives with separate hashes; a production canvas convention must never alter the archive master. Preserve source/tool/provenance records and review final artwork before any deployment.

## Production continuation

[The artwork workflow](GEEK-ART-PRODUCTION.md) and [500-position progress tracker](GEEK-ART-PROGRESS.md) organize the remaining original intake and future generation. Repeated historical labels, unassigned sets, source references and unverified availability remain explicit.

# Character concepts, artwork and collectible supply

The founder clarified on October 15, 2026: “So you see the direction I went with the 500 geek. 2500 different images.” This direction is preserved in [PR #120's pinned structure note](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/d2a8a9959a8be2870d2fca58261f27eeaf523f4e/docs/GEEK-500-COLLECTION-STRUCTURE.md) and reconciled into main as DR-012 on October 16.

| Count | Meaning | Status |
| --- | --- | --- |
| 500 | Planned Geek character concepts | Names, stable IDs and repeated historical labels need reconciliation |
| 5 per concept | Common, Rare, Epic, Legendary, Mythic artwork | Intended visual progression |
| 2,500 | Planned distinct images | Production paused; not a completed catalog |
| 20 | Supplied original PNGs in four five-tier sets | Preserved in paused PR #120; not imported or modified by this checkpoint |
| Unselected | Copies per artwork, total minted collectibles, prices and allocations | No supply or ownership decision implied by image count |

The existing `server/geek-collection.js` / `public/data/geek-500.json` implements an older 500-slot distribution, including historical GIGA/A.C.E. anchors and Elite slots. Those IDs/bytes remain for compatibility. They are not the completed implementation of the clarified character-plus-five-tier plan. COLL-001 must define a versioned mapping and resolve duplicate names, anchors and user-facing counts before any runtime migration. Cosmetic rarity never buys scoring or reward advantages.

Original asset bytes, filenames and provenance stay intact in the paused source branch. Further art intake/generation is ART-001 and awaits founder direction. More GIGA/A.C.E. artwork also awaits founder supply; preserve the reduced-character presentation from DR-014. NFT ownership, minting, settlement, acquisition rules and contributor rewards remain outside this documentation reconciliation.

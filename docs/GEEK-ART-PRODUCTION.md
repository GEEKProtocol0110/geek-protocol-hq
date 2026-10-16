# Finish the Geek artwork collection

The founder requested help completing all character sets on October 15, 2026. The [structure decision](GEEK-500-COLLECTION-STRUCTURE.md) defines 500 character concepts with five rarity artworks each (2,500 planned images). [The production tracker](GEEK-ART-PROGRESS.md) preserves every historical roster position and records each tier separately. It is a production worksheet, not the canonical NFT manifest.

## First: finish receiving existing work

Preserve each supplied original with its filename, exact bytes, SHA-256, dimensions and source. Check exact duplicates and inspect related versions. Update the set index and asset register before regenerating the tracker. Keep square/portrait originals intact; any display crop is a separate derivative.

The historical roster has 500 positions, 482 exact distinct names and 18 repeated-label pairs. Canonical names/IDs require reconciliation, not automatic deletion or renaming. A.I. Geek is a received complete set without an exact roster relationship; preserve it in the unassigned list until its placement is resolved. Existing legacy concepts (including Speedrunner Legendary and VR Rare) are potential references and must be reviewed before treating their tiers as empty.

## Produce one consistent set at a time

1. Select a character whose received originals and legacy references have been checked. Record its source position, brief, preserved references and actual missing tiers.
2. Establish the base character: recognizable face/silhouette, signature outfit or prop, palette and role. Use the founder's supplied sets as style references. Avoid third-party franchise characters and copied branded designs.
3. Generate new raster artwork using the available image-generation workflow and attached/reference image inputs. Preserve the references unchanged. A newly generated image is new production with tool/date/prompt/source references, never a recovered founding original.
4. Carry the character identity across all five tiers. Increase equipment, scene detail and effects deliberately: Common readable base; Rare upgraded prop/outfit; Epic stronger effects and setting; Legendary signature costume/aura; Mythic exceptional scene/transformation. These are working art directions, not scoring powers or strict requirements to put every Mythic on a throne.
5. Save every image separately at full available resolution. Check character consistency, hands/props, visible text, composition and thumbnail readability. Correct a candidate before starting a large batch. A contact sheet is a review aid, not five standalone delivery files.
6. Register the new candidate and its hash, then update tier status and next action. Preserve alternatives rather than overwrite an original. Work in small reviewed batches toward the full catalog.

## Track completion honestly

A received original, generated draft, revised candidate and approved delivery are different states. `availability-unverified` means no received original is linked; it is not a claim that an image does not exist elsewhere. The initial tracker reports zero generated and zero approved assets. Final delivery metadata and approval states require a versioned production record before those counts can increase.

Run `node scripts/geek-art-tracker.mjs --write` after source/index changes, then run it without `--write` to check reproducibility. Also run `npm run continuity:write` and `npm run continuity:check` after handoff changes. The tracker deliberately fails if a set's tiers, source name, duplicate asset IDs or received-file totals disagree.

Collection runtime migration, copies per artwork, mint supply, pricing, ownership and settlement are separate tasks. Artwork production creates no NFT entitlement or deployment approval.

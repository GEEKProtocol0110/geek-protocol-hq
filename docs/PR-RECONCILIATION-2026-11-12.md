# HQ pending-work reconciliation — November 12

Founder asked to fix the pending work after #265/#266 merged. This review refreshes current main; it does not authorize private-bank cutover, migration, payouts, CCE, collection ownership or A.C.E. activation.

| PR | Disposition | Evidence / remaining work |
| --- | --- | --- |
| #181 README | Superseded by current-main refresh | Preserve existing gallery/architecture and correct account access, old counts, game/app status and A.C.E. pause; do not overwrite newer links with the old whole-file rewrite. |
| #199 guest rewards read | Superseded by existing released behavior | Current testnet-status.js uses an explicit signed-in hint and sends no automatic rewards read for unknown/signed-out visitors. Existing tests cover this, sign-out, reconnect and stale responses. Do not restore guest session bootstrap here. |
| #204 season mapping | Design reconciled | RANKED-CAPACITY now records Season 0 preservation, sequential monthly numbering and excluded modes. Runtime stack stays held. Do not reuse its old DR-031/032 IDs: current IDs describe later decisions. |
| #205 October 30 record | Historical proposal retained, superseded as main merge | Current continuity/roadmap and #200/#231 own the live handoff. Keep #205's dated infrastructure, workflow and recovery checklists on its preserved branch/PR; do not merge its stale JSON, counts, free-plan assumptions or release ledger wholesale. Its unproved private-artifact pin, restricted rehearsal, editorial capacity, enforcement and recovery acceptance remain open. |
| #213 bank 503 | Fresh standalone fix carried to main | Unreadable/malformed public banks return generic QUESTIONS_UNAVAILABLE / 503, with no answer, filesystem path or parser-message leak; synthetic failure/recovery tests retained. No private-bank/season code imported. |
| #200/#206/#207/#231 | Keep draft/held | Approved immutable private artifact, bounded restricted rehearsal, season pre-clamping fix, editorial acceptance and enforcement/workflow gates remain prerequisites. No configuration cutover. |
| #203 CCE reviewer | Keep draft/held | Optional view-only role remains separate from CCE activation; no reviewer key created. |
| #120 artwork | Keep paused | Preserve original artwork/tracker and branch; no broad art production or runtime migration. |

Five superseded PRs may close after this current-main fix is merged; closing preserves review/commit history and does not delete branches. The remaining six are explicitly held work, not forgotten merge requests.

#265/#266 are merged/deployed. APP-001 stable Android signing still requires owner configuration of the protected main-only environment, reviewer and dedicated secrets. No signing key or domain association is fabricated. GAME-005 adds real opt-in Web Push, encrypted payloads, a bounded persistent move outbox and protected five-minute retry on the existing Pro project. Phone permission, OS scheduling/force-stop behavior and actual device acceptance remain separate.

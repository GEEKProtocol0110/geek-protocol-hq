# Quiz Quest — Solo campaign

Quiz Quest has three free, untimed solo chapters: First Signal (Kaspa origins), Inside the blockDAG (parent links, parallel blocks and consensus ordering), and Keys to the Grid (wallet-safety decisions). Each has three authored story scenes and six learning checks. The campaign starts with First Signal. Saved completion badges unlock the chapters in order: First Signal → Inside the blockDAG → Keys to the Grid. The server checks the full earlier-chapter chain on reads and every mutation. Each chapter retains its own saved place. GIGA is the welcoming story guide; A.C.E. supplies fixed teaching notes and checkpoint explanations. Dialogue is fiction, not a historical quotation, adaptive tutoring or live AI chat. The player’s chosen off-chain avatar appears at the chapter entrance and beside the story throughout each visit.

## Saved-record support codes

The October 9 founder phone check still showed an unverified saved chapter, and the founder reported that retrying did not visibly recover it. Issue #81 remains open. The existing record has not been inspected; this report does not establish a provider-specific cause or prove the saved step is recoverable.

Chapter reads and mutations still reject invalid records with HTTP 503 and `QUEST_STATE_INVALID`. They now also return a fixed support code identifying the failed validation group, without returning the raw record, player ID, attempt token, answer choices, or stored values:

| Code | Failed check |
| --- | --- |
| `Q_JSON` | Stored JSON parsing |
| `Q_META` | Record version, revision, timestamps, or mutation fingerprint |
| `Q_CONTENT` | Chapter selector or content version |
| `Q_RUN` | Attempt identity, token, start time, status, index, or order-list shape |
| `Q_ORDER` | Answer-option permutation |
| `Q_ANSWERS` | Current or completed answer-list shape, checkpoint, choice, grading, or timestamp |
| `Q_CURSOR` | Saved answer count and chapter cursor consistency |
| `Q_BADGE` | Badge identity, timestamp, or attempt reference |
| `Q_RECEIPT` | Completed summary shape, answer count, or badge chronology |
| `Q_LINK` | Badge/completion presence or completed-attempt linkage |
| `Q_REPLY` | Unverified transaction result without a specific record-validation code |

Retry visibly announces the check and disables its button while the request is pending. A repeated validation failure shows the support code; it does not automatically start, replay, or rewrite a chapter. A successful read resumes the verified server step. Older servers without support codes retain the previous recovery message.

For an affected player, record the support code, chapter, approximate time, and browser through the existing support conversation. If a retry still fails, inspect the corresponding record through authorized private storage access before proposing recovery. Keep any inspection read-only and do not paste raw records into public issues. The code identifies a failed check, not its cause; do not infer missing fields, relax validation, reset progress, or grant badges from the code. Validation tests verify repeated GET and rejected POST requests leave malformed records byte-for-byte unchanged. A failed post-commit response can still follow an accepted write, so retry loading is the authority for its outcome.

## Curriculum and sources

First Signal covers Kaspa’s research roots, November 2021 public proof-of-work launch and the distinction between KAS and GEEK. Inside the blockDAG uses small, labeled example graphs to teach parent references, parallel relationships and consensus ordering. Arrows point from child to referenced parent; the diagrams are authored teaching examples, not live network data. Teaching references were checked on October 5, 2026:

- [PHANTOM / GHOSTDAG paper](https://eprint.iacr.org/2018/104): protocol research and ordering.
- [Michael Sutton’s Kaspa 101 primer](https://michaelsutton.github.io/2022-04-23-kaspa-101-part1/): parent links, past and parallel relationships.
- [Kaspa history](https://www.kaspa.org/lore): launch year and no-premine/no-presale distribution.
- [Kasplex wallet integration SDK](https://github.com/kasplex/sdk-kiwi): application token integration.
- [HQ token specification](https://www.geekprotocol.xyz/litepaper/#economy): GEEK’s KRC-20 identity.

`public/quest/assets/chapter.js` is the ordered public chapter catalog and teaching module, separate from all ranked-bank items/IDs. Its answers can be inspected; these checks are learning activities, not a private or proctored assessment. Existing ranked-bank privacy and scoring remain unchanged. Internal source checks do not establish independent editorial approval or measured learning benefit.

## Progress rules

The chapter opens without creating a progress record. Explicit Begin starts an attempt at the first lesson. Each of three stops presents a lesson, then two checks. Only the current question can be answered. The first accepted answer is saved; the server returns its explanation. Explicit Continue acknowledges feedback before moving forward. After the sixth check, the final continuation completes the chapter and grants its badge in the same atomic write.

Wrong answers count as attempts and do not block completion. Each chapter’s badge (First Signal Explorer, BlockDAG Pathfinder or Grid Guardian) records completion of all six checks and their continuation steps. It does not certify mastery, score, identity or asset ownership. Ranked XP, prestige, Alpha credits, achievements, purchased inventory, token rewards, NFTs and treasury state are untouched.

The player can close the page and resume the same step. Exact retries of the most recent mutation return that saved result without another advancement. Requests with a different choice, stale revision, previous attempt ID or retired step token cannot overwrite an accepted answer or skip lessons/checks. A concurrent request may win first; the other browser resumes the canonical saved step.

Replay is available only after completion and asks for explicit confirmation. It starts a new attempt and answer order, retaining the original badge receipt and last-completed summary. The badge is granted once. Current missed answers and the previous completed visit’s missed-answer notes remain available; each later completion replaces the prior completed summary rather than storing an unbounded history.

## Storage and authority

One bounded record per chapter at `geek:quest:<durable-player-id>:<chapter-id>` contains schema/content versions, monotonic revision, one current run with six answer-order permutations and at most six answers, one last-completed summary with at most six answers, and one badge receipt. It has no automatic expiry. Verified identity recovery uses the existing durable player ID; guest access depends on retaining its session. There is no new wallet signature, transaction, photo upload, account linkage or local answer storage.

### Chapter selection and compatibility

`GET /api/quest?chapter=<id>` reads one allowlisted chapter. No selector retains the original First Signal contract. New clients include the same `chapterId` in each POST body; a mismatch is rejected. Chapters 2 and 3 require that field. Legacy First Signal bodies without it remain valid. Attempt IDs and retired step tokens cannot be reused for another chapter. Unknown, empty, array or conflicting selectors fail without a write.

`GET /api/quest?campaign=1` returns a bounded summary of all three chapters for the authenticated player, with progress counts and badge receipts. It omits answer/review content, attempt IDs, step tokens, raw permutations and player IDs. The campaign view creates no chapter records. An unreadable chapter returns only its ID and `available: false`. An unreadable prerequisite also makes its dependent chapter unavailable; it does not alter either record. A corrupt Chapter 2 cannot block First Signal. The map displays unavailable status explicitly, and offers retry. Campaign summary reads are snapshots, not a multi-record transaction; current selected-chapter responses take precedence in that page’s map.

### Sequential unlock

Inside the blockDAG requires the authenticated player’s verified First Signal completion receipt. `decodeQuest` validates the prerequisite record, including its badge and last-completed summary. All six accepted answers alone are insufficient: the final feedback continuation must save completion and the badge. Accuracy is not an unlock threshold; mistakes still count as attempts.

The server checks access on Chapter 2 GET and inside every mutation, including begin, answer, continue, replay and exact retries. A missing completion returns 403 `QUEST_LOCKED` with the Chapter 1 destination and no Chapter 2 run/review data. Campaign summaries return an explicit locked state and prerequisite instead of Chapter 2 saved details. A malformed prerequisite fails closed with 503, rather than granting access or clearing a save. Client fields, a direct URL or another player’s receipt cannot authorize access.

Chapter 1 completion is retained during replay, so starting a replay never relocks Chapter 2. The prerequisite read uses that persistent receipt, not the current attempt cursor. Normal gameplay preserves the receipt; there is no separate unlock flag, expiry or write. Existing Chapter 2 saves are retained byte-for-byte while locked and resume after First Signal is completed; earlier Chapter 2 play does not bypass the new prerequisite. Verified identity recovery keeps the same access through the durable player ID.

The map shows a locked card linking to the earliest unfinished prerequisite. Chapter 3 checks Chapter 1 even if an older Chapter 2 badge exists. A direct locked-chapter visit shows a completion instruction and recheck action, with story play, review and reference panels hidden. The map refreshes after completion so the new chapter opens immediately. This gates saved gameplay, not confidential curriculum: the chapter module remains public teaching content.

Existing First Signal v1 records retain their original key, schema/content versions, checkpoint IDs, badge ID and mutation fingerprint. They need no migration or rewrite; even an exact most-recent legacy command retry remains idempotent. Chapter 2 records include an explicit `chapterId`, validated on reads. The same production CAS/Lua advances all chapters against separate keys. Completing or replaying either chapter never writes the other one.

The handler derives transitions and answer correctness from the fixed chapter. Strict body allowlists reject client-supplied badge, score, clock, cursor, reward or ownership fields. Saved schema/content versions, cursors, permutations, accepted answers and badge/summary relationships are validated before reads or writes. Corrupt/unsupported records fail closed without replacement or a new badge. Future curriculum revisions require an explicit migration/version policy.

`QUEST_LUA` compares the exact prior serialized record and writes the whole next chapter state. The server validates the prior state and derives the next state, including preservation of the original badge. It serializes explicit nulls, arrays and booleans as JSON. Lua uses Redis TIME to replace server-only clock markers in that serialized string; it does not re-encode the record through cjson. The same atomic compare-and-set protects the original badge and timestamps accepted starts, answers and completion. Completion and the one-time badge cannot diverge under concurrent requests or a lost response. Public responses omit durable player/session IDs and raw answer-order storage. Quest status requires an authenticated session and is private to that identity.

`/api/quest` rewrites to the Quest handler in the existing ranked function, preserving the 12-function deployment count. Server authority is separate from the public teaching content. The profile loads Quest independently of game/collection services; a chapter failure does not block those records. No custom analytics events or learner answer fields are added. Existing public-page analytics retains its current privacy rules.

## Failure behavior and verification

The browser disables mutations while saving or after an unverified API failure, keeps any previously verified step/selection and offers Retry loading saved chapter. A failed initial load replaces the entrance and stop map with a recovery panel; Begin appears only after a successful selected-chapter read. Retry reads the canonical server state, including an answer accepted before a reply was lost. A failed mutation explicitly says the last action may have saved; a failed read does not claim a failed save. The server also avoids claiming that progress was unchanged when validation can fail after an atomic commit. No completion or badge is inferred from a client click. Public notes/source links remain readable during a First Signal service outage; later-chapter notes retain prerequisite gating until access is verified. The chapter map stays navigable through eligible chapters and locked-card prerequisite links. A failed campaign-summary request does not disable the active chapter. An unverified selected chapter remains unavailable in the map even if a later summary returns older progress. The dashboard loads the campaign separately from career and collections.

`tests/quest.test.js` runs the production CAS/Lua against disposable real Redis, with persistence disabled. CI requires it with `QUEST_REQUIRE_REDIS=1`; local runs may use `REDIS_SERVER_BIN`. Coverage includes write-free initial reads, explicit start, partial resume, privacy, skip/forgery rejection, concurrent different answers, exact retries, atomic completion, correctness-independent badge, replay retention, unchanged other ledgers, identity recovery and fail-closed corruption. Campaign coverage adds selector validation, independent progress/badges, cross-chapter token rejection, write-free/private summaries, legacy receipt/retry compatibility and isolated corrupt-record reporting, server-enforced prerequisite reads/mutations, final-step unlock, replay persistence and preservation of pre-existing Chapter 2 saves.

The October 9 save-recovery change adds real-Redis coverage with an unavailable Lua JSON encoder, verifying exact JSON types and Redis timestamps through start, answers, completion and replay. A simulated invalid post-commit reply verifies honest uncertainty, a read-only resume and idempotent retry. `tests/quest-client.test.js` executes the shipped page module with synthetic DOM/API fixtures for failed initial reads, lost save replies, mutation blocking, read-only recovery, stale summary isolation, timeout messages and prerequisite links. Existing malformed records remain rejected and preserved; this change does not reset or infer missing progress. The production record behind the reported screenshot has not been inspected, and the provider-specific cause is not established. These new checks are local automated tests, not new production or visual browser verification.

The subsequent client polish pass keeps phone chapter actions in normal story flow, removing the bottom-sticky bar that can overlap text. Accepted step changes focus and scroll to the new prompt, feedback or result, with heading scroll margin and 48-pixel action targets. Review summaries receive the intended minimum touch height. The client test checks focused/scrolled resume behavior; physical-phone visual acceptance remains pending. This UI change does not alter progress, prerequisites or badge rules.

Browser verification uses the actual handlers and disposable Redis with synthetic profiles: selected character in both entrance and story, keyboard start/chapter switching, independent First Signal resume, Chapter 2 diagrams and check/feedback flow, reload, saved review, failed/lost reply, stale second tab, completion/map/dashboard badge, replay confirmation, campaign/chapter outage retry, unknown chapter recovery and phone layout. It does not use production accounts, wallet approvals or production Redis.

## Chapter 3: Keys to the Grid (October 6, 2026)

Three Guardian station scenes present six decisions: decline a recovery-phrase request, identify a receiving address, recognize key-control evidence, decline a payment/message mismatch, inspect payment details, and stop at an unexpected recipient. Each choice gets the existing saved feedback and missed-answer review; story progression is shared, rather than a branching narrative. Completion is based on attempts and final continuation, not accuracy. No real wallet, seed entry, signature or payment occurs.

Primary references checked on October 6:

- [Kasware wallet keys and privacy](https://docs.kasware.xyz/wallet/other/privacy-policy): recovery material stays on-device; the provider cannot restore a lost phrase.
- [Kaspa KIP-5](https://github.com/kaspanet/kips/blob/master/kip-0005.md): message-signing proof and separation from transaction signatures.
- [Kaspa wallet integration docs](https://docs.kaspa.org/integrate/wallet): account, key and transaction flows.

Chapter 3 requires valid completion receipts for both earlier chapters. A corrupt ancestor fails closed; replaying either ancestor retains access. Each record still uses schema/content version 1 in its own key, with no migration of prior saves. Tests cover the full chain, an older Chapter 2 receipt without Chapter 1, independent completion/review, replay retention and durable identity recovery. Browser checks complete all three chapters with mistakes and verify immediate map/dashboard updates.

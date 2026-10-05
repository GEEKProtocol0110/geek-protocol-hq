# Quiz Quest — First Signal

First Signal is a free, untimed solo chapter with three authored story scenes and six learning checks. GIGA is the welcoming story guide; A.C.E. supplies fixed teaching notes and checkpoint explanations. Dialogue is fiction, not a historical quotation, adaptive tutoring or live AI chat. The player’s chosen off-chain avatar appears at the chapter entrance.

## Curriculum and sources

The chapter covers research-based blockDAG ordering, Kaspa’s November 2021 public proof-of-work launch and the distinction between KAS and GEEK. Teaching references were checked on October 5, 2026:

- [PHANTOM / GHOSTDAG paper](https://eprint.iacr.org/2018/104): protocol research and ordering.
- [Kaspa history](https://www.kaspa.org/lore): launch year and no-premine/no-presale distribution.
- [Kasplex wallet integration SDK](https://github.com/kasplex/sdk-kiwi): application token integration.
- [HQ token specification](https://www.geekprotocol.xyz/litepaper/#economy): GEEK’s KRC-20 identity.

`public/quest/assets/chapter.js` is a public teaching module written for this chapter, separate from all ranked-bank items/IDs. Its answers can be inspected; these checks are learning activities, not a private or proctored assessment. Existing ranked-bank privacy and scoring remain unchanged. Internal source checks do not establish independent editorial approval or measured learning benefit.

## Progress rules

The chapter opens without creating a progress record. Explicit Begin starts an attempt at the first lesson. Each of three stops presents a lesson, then two checks. Only the current question can be answered. The first accepted answer is saved; the server returns its explanation. Explicit Continue acknowledges feedback before moving forward. After the sixth check, the final continuation completes the chapter and grants its badge in the same atomic write.

Wrong answers count as attempts and do not block completion. The First Signal Explorer badge records completion of all six checks and their continuation steps. It does not certify mastery, score, identity or asset ownership. Ranked XP, prestige, Alpha credits, achievements, purchased inventory, token rewards, NFTs and treasury state are untouched.

The player can close the page and resume the same step. Exact retries of the most recent mutation return that saved result without another advancement. Requests with a different choice, stale revision, previous attempt ID or retired step token cannot overwrite an accepted answer or skip lessons/checks. A concurrent request may win first; the other browser resumes the canonical saved step.

Replay is available only after completion and asks for explicit confirmation. It starts a new attempt and answer order, retaining the original badge receipt and last-completed summary. The badge is granted once. Current missed answers and the previous completed visit’s missed-answer notes remain available; each later completion replaces the prior completed summary rather than storing an unbounded history.

## Storage and authority

One bounded record at `geek:quest:<durable-player-id>:first-signal` contains schema/content versions, monotonic revision, one current run with six answer-order permutations and at most six answers, one last-completed summary with at most six answers, and one badge receipt. It has no automatic expiry. Verified identity recovery uses the existing durable player ID; guest access depends on retaining its session. There is no new wallet signature, transaction, photo upload, account linkage or local answer storage.

The handler derives transitions and answer correctness from the fixed chapter. Strict body allowlists reject client-supplied badge, score, clock, cursor, reward or ownership fields. Saved schema/content versions, cursors, permutations, accepted answers and badge/summary relationships are validated before reads or writes. Corrupt/unsupported records fail closed without replacement or a new badge. Future curriculum revisions require an explicit migration/version policy.

`QUEST_LUA` compares the exact prior serialized record and writes the whole next chapter state. Redis TIME stamps accepted starts, answers and completion. Completion and the one-time badge cannot diverge under concurrent requests or a lost response. The existing badge is preserved by the Lua transition itself. Public responses omit durable player/session IDs and raw answer-order storage. Quest status requires an authenticated session and is private to that identity.

`/api/quest` rewrites to the Quest handler in the existing ranked function, preserving the 12-function deployment count. Server authority is separate from the public teaching content. The profile loads Quest independently of game/collection services; a chapter failure does not block those records. No custom analytics events or learner answer fields are added. Existing public-page analytics retains its current privacy rules.

## Failure behavior and verification

The browser disables mutations while saving or after an unverified API failure, keeps the displayed step/selection and offers Resume saved chapter. Resume reads the canonical server state, including an answer accepted before a reply was lost. No completion or badge is inferred from a client click. Public notes/source links remain readable during a chapter service outage.

`tests/quest.test.js` runs the production CAS/Lua against disposable real Redis, with persistence disabled. CI requires it with `QUEST_REQUIRE_REDIS=1`; local runs may use `REDIS_SERVER_BIN`. Coverage includes write-free initial reads, explicit start, partial resume, privacy, skip/forgery rejection, concurrent different answers, exact retries, atomic completion, correctness-independent badge, replay retention, unchanged other ledgers, identity recovery and fail-closed corruption.

Browser verification uses the actual handlers and disposable Redis with synthetic profiles: selected character, keyboard start, lesson/check/feedback flow, reload, saved review, failed/lost reply, stale second tab, completion/dashboard badge, replay confirmation, outage retry, and phone layout. It does not use production accounts, wallet approvals or production Redis.

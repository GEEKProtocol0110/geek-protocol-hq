# GEEK PROTOCOL

## Proof of Learning on Kaspa

Version 1.0 · November 2, 2026 · Published

All Hope, No Hype.

### Executive summary

Geek Protocol is a learning and game ecosystem that helps people understand Kaspa and other subjects through lessons, practice, explanation, and competition. Its core idea is Proof of Learning: an application record that links a learning attempt to its content, rules, and accepted result. A recorded result is useful evidence of participation and performance; it does not certify a person, establish lasting mastery, or alter Kaspa consensus.

The public Alpha already offers guided learning, timed quizzes, saved progress, free social play, and a wallet approved fair mint. The GEEK token exists on Kaspa Mainnet as KRC-20. Game credits and career XP are internal records. Token payments, community governance, collectible ownership, and school programs have separate release gates. This document defines the vision, current boundaries, proposed economy, and evidence required to advance each stage. The shorter litepaper remains an introduction.

### 1. Mission and approach

Knowledge should be worth building and sharing. Geek Protocol began with a father making index cards to teach his son to read. The same simple loop guides the platform: encounter an idea, practice it, understand a mistake, and return with a clearer next step. Kaspa is the first focused learning path; the broader question library spans Kaspa, video games, science fiction, technology, movies, history, comics, and pop culture.

The project has three linked participants: the learner, the original question author, and the reviewer who protects quality. The learner gets useful feedback. Authors can build a record of useful contributions. Reviewers check facts and resolve ambiguity before a question becomes trusted material. Future financial rewards require a budget and defensible eligibility rules; they cannot be inferred from a score alone.

The working principles are accessible learning, clear explanations, authoritative scoring, careful source review, privacy, and evidence for release claims. Kaspa provides the chosen settlement network for future token uses; HQ remains responsible for learning and game state.

### 2. The learner experience

A learner can begin without a wallet. Kaspa 101 introduces the network and links primary sources. Study with A.C.E. provides authored lessons, untimed questions, explanations, and focused retries. Quiz Quest has four ordered chapters with saved progress and badges. Memory Grid gives an untimed matching activity. These experiences serve learning rather than paid competition.

The Gauntlet is the flagship timed challenge: ten rounds of ten questions, with a free first round and later entry using internal Alpha credits. Daily Signal, Speed Signal, weekly and monthly challenges provide shorter return paths. The server controls attempts and scores. Free lobbies, Duel, and Trivia Royale offer social formats with their own rules. A.C.E. can act as an openly identified simulated opponent; paid wagers and funded tournament prizes remain future designs.

My HQ joins saved progress with XP, levels, optional prestige, achievements, and cosmetics. GIGA represents the welcoming community voice; A.C.E. represents teaching and analysis. Authored guidance is available today. An optional model assisted tutor requires separate activation, evaluation, and spending controls. A badge records completion under its stated rules; it is not a credential.

A first visit can be measured without turning every action into a reward. In a guided lesson, a learner reads an objective, sees a worked example, and chooses an answer. The explanation shows why one choice fits and why a tempting alternative does not. A focused retry then targets the concept that was missed. Timed play adds urgency after the groundwork is available. This sequence is the learning hypothesis that an instructor supported pilot must test; it is not a claim of measured improvement today.

| Record | What it represents | Economic boundary |
| --- | --- | --- |
| Study feedback | A concept interaction | No XP or token award |
| Quest badge | Chapter completion | No financial claim |
| Career XP and score | Progress under game rules | Internal application records |
| Alpha credits | Gauntlet practice accounting | No automatic token conversion |
| GEEK | KRC-20 wallet asset | Separate on-chain operations |

### 3. Proof of Learning model

For each assessed activity, the application can connect a resolved player, content version, permitted attempt, accepted answer, server time, scoring rule, and result. In timed play, the client receives one shuffled question and a bounded attempt token. An atomic server transition checks the deadline and prior state before recording an answer. Repeated requests recover the accepted transition instead of earning the event twice.

Different activities prove different things. Study feedback describes a concept interaction. Quest completion identifies an ordered chapter milestone. A scored round records performance under a defined time and scoring policy. None proves that the participant worked alone or remembers the topic later. Passkey access does not establish one human per account. Educational claims require reviewed assessments and measured retention in a defined pilot.

The goal is an inspectable chain from question objective to accepted result, with explicit limits on what that result means. Proof of Learning is an application method. Kaspa's Proof of Work secures its network independently. [1][2]

A useful receipt model can be expressed as R = (player, activity, content version, attempt, accepted choice, server time, rules version, outcome). Each field has a purpose: the content version identifies what was shown, the attempt prevents a second award, the time resolves the deadline, and the rules version explains the score. For an untimed teaching check, a deadline is absent by design. For a contested ranked result, the server's accepted transition is the authority; a screenshot of the browser is supporting evidence only.

A verified result has three layers. Authenticity asks whether the server accepted it for the resolved player. Integrity asks whether its content and scoring version can be recovered and recomputed. Educational validity asks whether the question actually measured the stated idea. A replay lock can address the first two, while careful authorship and independent review address the third. These layers should be reported separately in any partnership evaluation.

Abuse remains possible even with secure state transitions. A learner could search the web, share an answer, automate a browser, or coordinate across accounts. Those behaviors limit what an open quiz can certify. A future qualified assessment would need a new threat model, accessible accommodations, honest supervision rules, and explicit consent. Its claim cannot be retroactively assigned to Alpha results.

### 4. Architecture and authority

![Figure 1. Application authority and the wallet signing boundary.](/whitepaper/assets/architecture.svg)

HQ serves public pages and trusted API functions. Upstash Redis holds sessions, runs, progress, replay locks, and Alpha accounting. The browser displays questions and submits a selected option; it cannot decide the answer, deadline, reward, or balance. The API validates identity and state, and commits the result. Wallet signing is controlled by the user's wallet, outside the game server. [3]

A normal ranked request follows this order: the server selects an eligible question and shuffles options; the browser receives display content, an opaque token, and the deadline; the player submits a choice; the server atomically checks eligibility and time; the resulting score and progress are saved. The server is the authority for each transition. Network failures require reconciliation with the saved state before any retry of a value bearing action.

Public teaching material is deliberately inspectable. Historically published question banks in the repository have exposed competitive content even though answer keys are absent from normal game responses. A restricted private ranked bank is proposed in PR #200. Until a reviewed cutover is accepted, this paper makes no claim that the ranked pool is secret. [4]

The fair mint is a distinct path: HQ checks the pinned GEEK deployment and asks the user to approve the mint in a compatible wallet. Indexer data can report token operations; it does not authenticate a Geek account or authorize a game result. No seed phrase is required by HQ.

The system's trust boundaries matter during a fault. If Redis cannot be reached, a new ranked attempt must not be converted to browser scored play. If an answer request times out after the server commits it, a read should recover the stored result before another mutation. A damaged or missing question version should prevent a new private ranked run, while retained historical keys continue to support existing runs where the design requires. Availability and fairness must be tested together.

Wallet interactions have their own authority chain. A mint begins with a deployment identity check; a compatible wallet presents a request, the user signs, the transaction reaches Kaspa, and an indexer reports the observed operation. HQ cannot claim a mint succeeded from an optimistic UI event. A treasury reward has a separate sender and funding responsibility and therefore needs a separately audited signer. Neither flow can be collapsed into an Alpha credit balance.

### 5. Identity, privacy, and recovery

Guest access supports the first visit. A saved Geek account uses passkey based access and the project's existing recovery paths. Mainnet and Testnet-10 receiving addresses can be saved separately after fresh account confirmation. An entered address specifies a destination; it alone is neither authentication nor proof of wallet ownership. The user retains control of wallet signing. The applicable WebAuthn standard describes public key credentials as scoped authentication credentials. [5]

Private progress, recovery material, and payment destinations belong behind the account and operator boundaries. Existing analytics record bounded activity categories without answer text, wallet addresses, or player and run identifiers. Device linking, guest session loss, and credential manager recovery each have different failure modes. A local test or a successful same phone return does not prove universal cross device recovery.

A child or school program needs its own consent, age appropriate account roles, data minimization, retention policy, and measured learning objective. No school account hierarchy or institutional authorization follows from the consumer Alpha.

A guest can try learning, save progress, and later add a receiving address. Fresh account proof helps prevent an unattended session from redirecting a future reward. It cannot recover funds sent to an incorrectly entered destination; address validation and a clear confirmation step remain essential.

Only the information needed to operate a specific feature should be retained. Public standings need a display name and score, not a wallet or recovery identifier. Editorial reviewers need question provenance and decision history, not a learner's private account records. Education pilots require deletion and export procedures that fit the agreed data policy before recruitment. These are design commitments to verify in the applicable release rather than claims of blanket compliance.

### 6. Content integrity

Question quality determines whether a result is worth recording. Every retained reviewed question needs one clear learning objective, a defensible correct choice, plausible alternatives, an original explanation, specific primary evidence, licensing provenance, and a dated review decision. Editorial review examines semantic duplication, contextual clues, changing facts, category fit, difficulty, and bias in answer options. Automated similarity checks identify candidates; they cannot certify truth.

Corrections receive new question identities while old issued answer keys remain available for unfinished or historical grading. Retired questions stay out of new selection. Concept aliases prevent a repeated fact entering through another wording. Counts may fall after quality review, and a large imported pool is not equivalent to a reviewed bank.

The founder's Content Engine gate is 1,000 distinct source reviewed concepts in each of eight categories plus separately approved economy rules. New contributor intake, publication, and credits remain held under that gate. Independent editorial acceptance must be distinguished from internal source checks. [6]

For private ranked competition, future content needs restricted storage, immutable version binding, author and independent fact checker separation, delayed answer reveal until the round locks, leak response, and season rotation. Previously public questions should be treated as exposed. Size alone cannot prevent coordinated harvesting. These requirements are under review, not a completed production cutover. [4][7]

A question travels through an editorial lifecycle: intake, duplicate screening, author revision, primary source fact check, independent review, approval for an eligible pool, monitoring, correction or retirement. Every step should leave a dated disposition. A contributor cannot self certify their own item for a monetary reward. The reviewer must be able to reject a factual source that supports the topic but fails to support the actual answer.

Consider two questions with different wording that both ask the same one fact. They should count as one concept for capacity and should not both appear in a run. By contrast, two questions about the same Kaspa subject can be distinct if one tests a network mechanism and another tests a wallet safety decision. An audit must judge the objective, rather than only normalized text similarity. This is why the 1,000 target means reviewed distinct concepts, not merely 1,000 rows.

A source can change. For a dated technical fact, the review record needs the relevant software version or time context. When an item is corrected, a new identity protects the interpretation of old answers; the previous item is retired from future draws but preserved for historical grading. A disputed run should identify the content version used. Licensing and attribution are part of the same acceptance decision.

### 7. GEEK token specification

| Parameter | Pinned specification |
| --- | --- |
| Network and standard | Kaspa Mainnet / KRC-20 |
| Ticker | GEEK |
| Maximum supply | 144,000,000,000 GEEK |
| Decimal precision | 8 |
| Premint | 0 |
| Mint limit | 100,000 GEEK per mint |
| Public treasury settlement | Disabled |

GEEK is a KRC-20 token deployed on Kaspa Mainnet. HQ pins the ticker, deployment hash, deployer, maximum, mint limit, decimals, and premint for matching deployment checks. Its specification states a maximum of 144,000,000,000 GEEK, eight decimals, zero premint, and a 100,000 GEEK per mint limit. The maximum is a cap, not a statement of circulating supply or treasury ownership. Current mint availability requires a fresh matching indexer result. [8]

The fair mint remains an explicit wallet action. The 100,000 GEEK mint limit is a token amount, not a guaranteed exchange rate against KAS. Game XP and Alpha credits are not KRC-20 tokens and do not carry an automatic conversion claim. GEEKT on Testnet-10 is a separate pilot asset. A successful test transfer does not activate a Mainnet reward system.

KRC-20 to KCC-20 migration is being designed separately. An acceptable proposal must preserve existing holder entitlements and burn history, reconcile the eight decimal supply representation, establish compatible artifacts and wallets, and pass independent review. No migration or replacement contract is authorized by this paper. [9]

The pinned specification uses integer smallest units: 144,000,000,000 multiplied by 100,000,000 equals 14,400,000,000,000,000,000 raw units; a 100,000 GEEK mint limit equals 10,000,000,000,000 raw units. These constants are checked against the deployment identity, not used as a substitute for live minted supply. A dashboard should distinguish the maximum, cumulative minted amount, current indexer observation, and a particular wallet balance. Any unknown state must display as unknown rather than available.

The Kaspa base network, its native KAS currency, and KRC-20 indexing have distinct responsibilities. A Kaspa transaction can carry a token operation, while the indexer interprets the operation for the KRC-20 balance view. Geek Protocol relies on a matching token deployment and bounded source responses. No statement about Kaspa block throughput or future upgrade is needed to establish HQ's learning purpose or current payment readiness. [1][2][8]

### 8. Economy and proposed rewards

![Figure 2. Proposed allocation of an eligible platform fee; settlement is pending.](/whitepaper/assets/fees.svg)

A sustainable reward must have an identified source, eligibility rule, upper exposure bound, and proof of delivery. The proposed 70/30 rule applies to eligible collected platform fees: 70 percent would replenish the reward pool and 30 percent would be allocated for burning. It is not a division of GEEK's 144 billion maximum and it does not apply automatically to the gross value of a transaction. Protocol mint fees are separate. [10]

Amounts are calculated in the token's smallest integer unit. For an eligible fee F, proposed recycle pending equals floor(7F/10); burn pending equals F minus recycle pending. The two values always total F. If the eligible platform fee is 10 GEEK, the proposal assigns 7 GEEK to reward funding and 3 GEEK to burn pending. Pending allocation is an accounting plan. An actual burn requires a confirmed operation and reconciliation.

The founder selected 100 GEEK per qualifying completed round as a model for future planning. Qualification, a funded reserve, mode rules, player limits, and payment terms remain unfinished. Creator rates are also unselected. No payable promise arises from this model, a game screen, or an Alpha ledger. Paid store items and assists need rules that prevent purchasing ranked score or a claim of knowledge. [10]

The proposed fee policy is a rule for the fee portion of an eligible purchase or game action, if and when that action is approved. For example, a 100 GEEK gross transaction could have a 10 GEEK platform fee, zero fee, or another explicitly quoted amount. Only the actual eligible fee enters the 70/30 calculation. A transaction receipt must show gross amount, fee basis, rounding, allocation, and later confirmed transfers. This prevents a simple marketing ratio from silently becoming an unknown charge.

The reserve model needs conservation across every state: funded balance minus completed payouts, committed liabilities, and safety hold must remain nonnegative. The exact cap and pause policy have not been selected. A reviewable proposal should simulate peak participation, repeated free rounds, failed sends, network fees, and uncertain receipts before it selects a payable rate. A spreadsheet scenario is evidence of arithmetic under its assumptions, not proof that the treasury owns the modeled assets.

The possible store includes cosmetics and assists such as 50/50 and Extra Time. Free assisted practice trials already exist separately. Paid eligibility and a pricing schedule have not been approved. An assist in a rewarded competition would change what the result means; its score or reward treatment must therefore be specified before any sale. Learning should remain useful to a person who never buys GEEK.

### 9. Settlement and treasury discipline

Before any Mainnet reward, the project must verify a real reserve, select authorized signers, define bounded budgets, and independently review the exact release. Each eligible event needs a stable ID; a payment intent needs an immutable recipient and amount; a journal must retain replay locks and the exact transaction lineage. A timeout cannot be treated as proof that broadcast failed. Recovery must inspect the prior operation before trying again.

A transfer is complete only under the stated matching indexer and confirmation policy. A displayed hash alone is insufficient evidence. Limits per player and period, loss and abuse monitoring, circuit breakers, a pause procedure, and an isolated restore drill belong to the launch design. Burn and fee distribution require separate implementation and proof. The existing Testnet-10 work provides a bounded rehearsal; public Mainnet treasury settlement is disabled. [11]

The project's treasury account names are accounting categories. They do not establish funded wallets. A reserve address configured in a dashboard does not prove possession or balance. Public reporting should identify actual funded assets and liabilities only from verified evidence, while protecting private key material.

A payment journal should distinguish earned, admitted, signed, broadcast, indexed, confirmed, failed, and unresolved states. The state must never jump from an uncertain network call to a new signed payment merely because the response was lost. The same recipient, asset, amount, and earning identity need to survive retries. In a recovery drill, operators should prove that a restart cannot pay the same event twice while allowing a genuinely unpaid event to move forward.

Treasury control includes the human process. Separate the person who proposes a budget from the authority that activates a signing limit where feasible. Record who changed a cap, when it took effect, and which pending liabilities existed. Publish aggregate funding and payment results without exposing private learner identities or signing secrets. A pause should stop new payment admissions and preserve already committed journals for reconciliation.

### 10. Creators, collectibles, and governance

The Community Content Engine envisions original author submissions, independent review, visible attribution, and a history of corrections. A possible recurring usage reward needs a payable use definition, funded pool, contributor splits, caps, and abuse controls. Grants likewise require a proposal, budget, milestones, and accountable execution. Historical internal credits do not create future token claims.

The character collection direction is 500 distinct Geek concepts with five rarity artworks per concept: 2,500 planned images. That is an art structure, not an NFT supply or a count of finished images. Copies, allocation, prices, ownership standard, and migration from the older runtime schema remain unresolved. Existing off chain stickers and avatar cosmetics carry no verified NFT title. Artwork production is paused pending founder direction. [12]

The long term aim is a community led DAO. Administration is centralized today and GEEK ownership carries no current HQ voting or treasury execution rights. A credible transition requires published proposal eligibility, voting and delegation rules, quorum, conflicts, dispute handling, role separation, and independent review of value moving authority. Community participation can grow before any on chain governance exists.

The creator path cannot promise passive income from a question appearing on a public page. A payable use needs an unambiguous event, attribution after revisions, a funded rate, repeated use limits, fraud detection, and a dispute process. The same principle applies to tournaments and grants. Published terms should identify the funded rate, eligible event, and dispute process before contributors rely on a payment.

An eventual DAO should grow from documented decisions and contributor participation rather than from a token balance checkbox. A proposal system can begin with public discussion and published rationale. Voting authority, treasury execution, emergency powers, and appeal rights are separate controls to implement only when they can be tested. It should be possible to explain to a new participant who can change a rule, who can spend funds, and how an error is corrected.

### 11. Security and operational assurance

The main threats include stolen account credentials, answer harvesting, scripted farming, malicious content submissions, compromised operator access, indexer failure, and signer or provider faults. Mitigations include fresh and single use proofs, trusted origin validation, server controlled state, atomic transitions, scoped roles, rate bounds, private content handling, and fail closed configuration. Each control must be tested in the environment where it matters. [3][4]

An internal test suite is evidence of implementation, not an independent security audit. The project has not completed the application penetration test or a Mainnet treasury and signing audit. Critical and High findings need remediation and retest against the same release candidate before value movement. Preview credentials and data must be isolated from production.

Recovery is an operating requirement. A Git clone restores committed code but not database contents, secrets, domains, or external releases. Local database restore evidence is narrower than a managed provider and full application restore. The current manual export policy offers no guaranteed daily retention. Operator access, monitoring, incident response, and a trusted second maintainer need verified procedures. [13]

A security claim should name its boundary. A browser cannot be trusted to withhold answer keys already present in publicly distributed source. A private bank reduces casual exposure but cannot prevent players from recording what they see or coordinating to harvest it. Restricted previews, version pins, leak scans, rotation, and response timing reviews are necessary evidence before claiming a new competitive standard. Operational monitoring must identify failures without logging the protected content itself.

The product also needs an honest continuity plan. A source snapshot, database export, and recovery credential serve different purposes. Verify a restore in an isolated environment, compare expected player and payment records, and ensure no test worker can broadcast from the restored copy. Repeat after important schema or signing changes. A healthy website response by itself does not prove the ability to recover a player or an uncertain payout.

### 12. Roadmap and proof gates

The first stage is an accessible free learning loop: reviewed lessons, understandable feedback, saved progress, and a reliable returning learner experience. The next is content and competitive integrity: audit all eight categories, preserve historical grading, build reviewed capacity, and accept the private ranked bank with restricted end to end tests. [6][7]

Operational readiness follows: protected roles, monitoring, current exports, isolated restore and application recovery, tested device access, and a frozen release for independent review. A bounded economic stage would then require verified funding, explicit eligibility and rates, low limits, reconciliation, audit evidence, and an owner approved activation. None of these stages has a promised calendar date.

Expansion into stores, collectibles, creator payments, education, professional learning, and community governance should follow bounded pilots with defined outcomes. Useful measures include distinct reviewed concepts, disputed answer rate, learner return and delayed retention in a consented study, recovery success, and actual funded exposure. Page views, XP, and token transfers alone cannot measure learning.

### 13. Sources and document control

Version 1.0 uses the HQ code and maintained project record at main commit 0302dfe01fc6447a74972978649b2b44c98cf5c6. The numbered references identify supporting documents and pending proposals. Repository implementation and dated evidence govern operational status. The founder approved this edition for publication on November 13, 2026. The litepaper is the shorter overview and may require separate editorial reconciliation. No whitepaper revision activates an economic or governance gate.

[1] [Kaspa project and network overview](https://kaspa.org/).
[2] [Kaspa Rust node reference implementation](https://github.com/kaspanet/rusty-kaspa).
[3] [HQ architecture and trust boundaries](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/ARCHITECTURE.md).
[4] [Private ranked bank proposal, PR #200](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/200).
[5] [W3C Web Authentication Level 3](https://www.w3.org/TR/webauthn-3/).
[6] [Maintained content audit and review requirement](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/QUESTION-BANK-AUDIT-2026-10-27.md).
[7] [Private bank review and rotation design](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/PRIVATE-BANK-REVIEW.md).
[8] [Pinned GEEK token deployment](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/server/geek-deployment.js).
[9] [KRC-20 to KCC-20 design issue #216](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/216).
[10] [HQ economy protocol](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/ECONOMY-PROTOCOL.md).
[11] [Automatic GEEKT reward protocol](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/AUTOMATIC-GEEKT-REWARDS.md).
[12] [500-concept collection structure](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/GEEK-500-COLLECTION-STRUCTURE.md).
[13] [Backup and recovery procedure](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/0302dfe01fc6447a74972978649b2b44c98cf5c6/docs/BACKUP-RECOVERY.md).

Copyright 2026 Geek Protocol. This document describes a project and its development plan; it is not an offer of a token payout, a financial return, or an educational credential.

# Economy stress lab — October 14, 2026

The lab tests **current internal credit behavior** and **a separate hypothetical GEEK reserve**. It does not convert credits to tokens, verify treasury funding, authorize a payout, execute a burn or change game rules. The baseline is reproducible in [economy-stress-report.json](economy-stress-report.json).

## Concrete baseline findings

| Case | Result | Meaning |
| --- | --- | --- |
| Perfect Gauntlet from zero credits | 46,300 granted; 14,240 spent; 32,060 closing credits | Internal credit issuance exceeds entry debits. These are not collected token fees or funded token liabilities. |
| Five correct answers in each round, from zero | Nine rounds completed; 5,910 credits remaining; round ten needs 6,000 | Correctness alone does not determine progress: entry affordability matters. |
| Four correct answers per round, from zero | Two rounds completed; 80 credits remaining; round three needs 100 | No later entry or reward is modeled after the first unaffordable round. |
| One million perfect free-round completions | 100 million internal credits in aggregate | Repeated legitimate runs grant again. This is across players/time, not a one-player, same-hour forecast. |
| Zero opening reserve; 1,000 one-GEEK fees; 1,000 proposed one-GEEK rewards | 700 GEEK recycle pending; 300 burn pending; 700 modeled claims covered, 300 blocked | The entire fee volume cannot fund rewards when 30% is separately allocated to burn pending. |
| One million one-raw-unit fees | Zero units recycled; one million burn pending | Per-receipt floor rounding cannot allocate 0.7 of an indivisible unit. This is 0.01 GEEK in total fees, not one million GEEK. |
| Same tiny fees treated as one combined fee, for comparison only | 700,000 raw units (0.007 GEEK) would recycle | Batching changes the rounding result. The implemented policy remains per receipt; the comparison does not change it. |
| Empty reserve and no fees; one million proposed one-GEEK claims | Every modeled claim blocked | No negative reserve, borrowing, pending-burn spending or invented funding. |
| Assumed 1,000-GEEK opening reserve, no fees; 1,000 one-GEEK claims; 100-GEEK cap | 100 covered, 900 blocked, 900 GEEK modeled reserve remaining | A configured cap in this model can bind before reserve depletion. It is not an active production payout cap. |

In the fees-only example, 1,429 identical one-GEEK fees would recycle enough to cover the 1,000-GEEK demand before the cap. This arithmetic does not predict that those fees will arrive. The 70/30 rule is a fee-allocation policy, not a sustainability guarantee or a supply allocation.

## Sources and assumptions

`server/game-economy.js` holds the unchanged round entries, per-correct grants, maxima and ranked start limit. The live ranked handler and the model import the same definitions. The model follows ten whole correct-answer counts, debits each affordable entry and grants its modeled completed round. It uses BigInt for analysis and rejects a path beyond the live safe-integer profile counter ceiling. It does not model XP, player skill probabilities, timing, paid assists, drop-off, storage failures or alternate earning/spending paths. Existing Alpha profile and score behavior is unchanged.

Current starts are limited to twenty per network fingerprint per hour, across ranked modes. A fingerprint is not proof of one person; shared networks and different fingerprints cannot be treated as a human identity count. One thousand starts need fifty start-limit windows for one unchanged fingerprint. That is a window count, not a promised completion time. No lifetime credit-grant cap is introduced here.

The reserve model takes an assumed opening token reserve, a count and eligible fee amount per receipt, a count and amount of distinct equal-sized proposed claims (retries are not new obligations), and an assumed total reward cap. Money inputs are exact canonical integer strings in the existing eight-decimal denomination. The owner form accepts decimal strings without converting through floating-point money.

For this **single batch**, all fees arrive before claims. The opening reserve plus collected fees must fit within the pinned maximum token supply; the model does not recirculate tokens between transactions. Requested rewards may exceed the supply as a stress demand, but a modeled reserve cannot. Counts are bounded at one million and calculated in closed form rather than looping over every proposed claim.

Each fee uses the existing shared `splitFee`: recycle pending is `floor(feeRaw × 70 / 100)` and burn pending receives the remainder. Reward funding is only the assumed opening reserve plus recycle pending. It excludes burn pending, unverified donations, newly minted tokens, player Alpha balances and proposed creator/tournament/operations funding. All of the 70% recycle portion is assigned to this modeled reward reserve. Sharing it with creator, tournament or operations pools would leave less for these claims; those allocations are not finalized here. There are no refunds, reversals or repeated token circulation within this model.

Covered claims fit both the available modeled reserve and the assumed cap. Equal-sized claims are indivisible; remaining dust stays in the modeled reserve. Funding and cap gaps can overlap and must not be added together. Conservation is checked as:

```text
fee total = recycle pending + burn pending
opening reserve + recycle pending = covered rewards + closing reserve
covered rewards <= assumed cap
closing reserve >= 0
```

The per-receipt rounding difference from a single aggregated allocation is nonnegative and less than one raw unit per receipt. Small fees can therefore have an effective split far from 70/30, despite exact conservation. The rounding policy is explicit and unchanged; any future minimum fee, carry or batching policy needs its own reviewed design.

## Replay and actual-handler evidence

Local real-Redis tests submit one hundred concurrent identical planning receipts. They commit one receipt and return its original hash to all retries. Reusing its reference with different terms is rejected without replacing it. Losing the reply after an accepted commit still returns the original receipt on retry. These are **planning** receipts, not payments; their tests create no funded profile or wallet transaction.

The actual ranked handler completes two perfect free rounds with concurrent answer retries. Each committed round grants 100 internal credits once; a genuinely new completed run grants the next 100. Repeated finish calls do not grant again. No token planning journal is created by those credit grants. This demonstrates the distinction between duplicate processing and legitimate repeat play. It is not a production load or anti-bot certification.

## Operator use and reproduction

Open `/ops/stress/` with the current owner session. The form shows assumed values and keeps the credit and token results separate. POST calculates only; it cannot append a journal, queue a reward, edit a profile or update configuration. The owner session, trusted Origin, JSON body and thirty calculations per network fingerprint per ten minutes are enforced. Unknown fields cannot request a different policy or turn transfers on. Views clear after errors, navigation and sign-out; no credentials, analytics or scenarios enter browser storage.

```sh
npm run economy:stress
node scripts/economy-stress.mjs > docs/economy-stress-report.json
npm run economy:stress:check
```

CI checks that the saved baseline matches the current model. Tests cover 1,000 generated fee/count combinations, exact values beyond the floating-point safe range, credit-counter ceilings, zero fees/caps, empty reserves, indivisible claims, impossible single-batch supply, real Redis concurrency/lost replies and private access. Client fixtures exercise behavior, not rendered phone acceptance.

Before monetary activation, define funded liabilities, budget reservation, outstanding obligations, reversals, retained idempotency, settlement evidence and reconciliation in the actual treasury service. The lab is neither that service nor an independent financial/security audit. The simulation's caps never replace the existing disabled settlement boundary.

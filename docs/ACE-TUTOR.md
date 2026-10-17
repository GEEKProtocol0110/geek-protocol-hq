# A.C.E. lesson tutor — October 17, 2026

ACE-001 now has a bounded implementation in the existing plain JavaScript/Vercel stack. It is not an autonomous administrator. The default lesson guide requires no model service. Live AI activation and evaluation are separate acceptance steps; no paid model request or budget change was performed in this candidate.

The Study path is **choose a topic → Ask A.C.E. about this lesson → enter a question → Find lesson help**. The server selects three relevant authored fragments from that topic's steps/example and returns their existing primary sources. It never retrieves ranked answer keys, private profiles, history, wallet records or arbitrary URLs. This is small lexical retrieval over curated lessons, not an open-web research agent. An unrelated question can receive lesson excerpts rather than a complete answer.

When available, an unchecked opt-in offers an AI explanation. Only that question (400 characters maximum) and selected lesson excerpts are sent to AI Gateway. No player identifier or saved learner record is included. The application saves no conversation in the player profile; the gateway/provider may retain requests under its policy. Review those policies before activation. Topic changes and leaving the page clear the question, consent and response. The response uses plain text, selected evidence and server-owned source links.

## Activation configuration

All configuration is server-only. Use the intended environment; Preview must not borrow Production secrets or budget. These names were absent from deployed project configuration at the candidate checkpoint.

| Name | Requirement |
| --- | --- |
| `ACE_TUTOR_ENABLED` | Exactly `true` after the pilot is ready; absent/false uses lessons only |
| `ACE_TUTOR_MODEL` | Exact `provider/model` ID checked against the live AI Gateway catalog; no hardcoded model recommendation |
| `ACE_TUTOR_DAILY_LIMIT` | Canonical integer 1–1000; set a small pilot allowance |
| `ACE_TUTOR_BUDGET_READY` | Exactly `true` only after the operator checks the selected model, spending cap and data policy |
| Gateway authentication | Vercel OIDC in deployments, or a scoped `AI_GATEWAY_API_KEY` where needed; never paste it into chat or source |

The budget-ready flag is an operator acknowledgment, not an API check or a dollar cap. Configure the actual Gateway budget separately. Current Gateway documentation describes its budget as a soft cap: the crossing request can finish. App-level quotas also are not a financial ledger or a substitute for provider-side spending limits. Changes require a new deployment and a bounded live check before expanding access.

The exact installed AI SDK is **7.0.143**, integrity locked in package-lock.json. Its bundled docs/source were consulted for `generateText`, `Output.object`, JSON Schema, aborts, timeouts, output limits and mock models. The complete model catalog was retrieved October 17 (475 IDs); a model/budget was not selected or purchased. Reference: [AI Gateway setup](https://vercel.com/docs/ai-gateway/getting-started), [budgets](https://vercel.com/docs/ai-gateway/observability-and-spend/budgets) and [data controls](https://vercel.com/docs/ai-gateway/security-and-compliance).

## Limits and failure behavior

- Each reserved generation allows 512 output tokens and eight seconds, without SDK retries. The browser bounds the full request to 25 seconds; existing Redis calls retain their own eight-second bounds. The shared ranked function allows 30 seconds.
- One atomic Redis script reserves a daily attempt, a 15-second player lease and one of three global leases before calling a model. It uses Redis time for lease expiry. Player/IP request limits precede reservation. Production and Preview use separate quota namespaces.
- Reservations remain counted after failure or an uncertain reply. A lost reservation response never invokes the model. Cleanup never repeats generation; leases expire if cleanup fails. Restore or external database modification can roll counters back, so the independent Gateway budget remains necessary.
- Disabled service, no consent, busy/quota state, timeout, provider failure or invalid output returns authored evidence. Fabricated evidence IDs, unselected URLs, markup, oversized/empty answers and duplicate/missing citations are rejected. Sources are always chosen by the server.
- A narrow input filter catches selected instruction/secret/reward patterns. It is not a complete prompt-injection detector. System instructions and the lack of tools contain authority; there is no claim that citation validation proves factual entailment. An AI explanation can still be wrong.
- The tutor cannot grade, award XP, publish content, manage access, modify recovery settings, sign or transfer funds. None of those capabilities is exposed as a model tool. Existing deterministic controls retain authority.

## Read-only operations and evaluation

`/ops/ace/` uses an owner-session-protected, no-store GET to show configuration readiness, reserved attempts and limits. It performs no generation or operational action, does not expose a credential/model secret, and reports damaged usage as unavailable. There are no write methods for this view. Broader operational assistance, proposals and audited role-checked tools remain future work.

Tests cover the actual installed SDK structured-output contract with a mock language model, selected-lesson retrieval, input rejection, opt-in/default-off behavior, invalid citations, provider failures, timeout/abort, atomic quota/concurrency, lost replies, no progress mutation, API origin/session/rate limits and private read-only readiness. Shipped-client tests cover safe rendering, source filtering, consent, stale topic responses, retained failed questions and no automatic retry. Synthetic evaluations are not live model quality or independent review.

Before activation: select a model and bounded budget, inspect data retention, run a small live set including out-of-scope questions and adversarial prompts, compare every claim with the lesson evidence, inspect usage/latency/errors in Gateway logs, and record the result. Keep the pilot opt-in and preserve the lesson fallback. No monetary or publication gate is opened by this implementation.

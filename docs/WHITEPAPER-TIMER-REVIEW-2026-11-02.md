# Whitepaper and glass timer review - November 2, 2026

Tasks: DOC-001 / UX-008. Base: `0302dfe01fc6447a74972978649b2b44c98cf5c6`.

## Scope

- `docs/WHITEPAPER.md`: first full whitepaper, v1.0 publication candidate. Describes the learning model, actual HQ architecture, identity, content review, competitive answer exposure, token deployment, proposed economics, security, governance and evidence-based delivery gates.
- `public/whitepaper/`: semantic, printable web edition generated from the Markdown. Unindexed while a review draft. A litepaper link and README entry make the relationship explicit.
- Play: move the single existing countdown from the HUD into an isolated answer stage. Keep four glass panels in two columns on phones, visible numeric time in the center gap, color warnings, text wrapping, focus indication and forced-color support. Preserve the `data-timer`, `data-timer-line` and `.timer-wrap` selectors. Game JavaScript and server transitions remain unchanged.
- Update the maintained record and deterministic metadata/continuity outputs.

## Review boundaries

The user has requested implementation. The specific push/merge batch is still pending founder review under the recorded Geek Bot handoff. No repository comment, push, PR, merge or deployment has been made by this candidate. This change does not cut over #200, activate Mainnet/CCE/ownership, execute migration or reopen artwork production.

The current litepaper contains historical statements about private answers, sign-in and feature states. The new draft uses source and maintained decisions over those statements. A comprehensive litepaper refresh is a separate editorial pass.

## Validation

- Full `npm run verify` passed with native Redis 7.4.2: 725 HQ tests and nine signer checks, zero failures/skips. Question, archive/collection, 311 security assertions, repository, economy, continuity, site and whitepaper parity checks all passed. Initial missing worker dependency was resolved by installing its existing lockfile dependencies; no dependency manifest change was required.
- Chromium checked 320/375/412/768/1280px layouts: one timer centered on both axes; four answer targets remain at least 44px; the number stays between the rows; no horizontal document overflow, including an intentionally extreme long option. Focus and clicks reached all four targets. Forced-colors mode was available; CSS supplies system-color fallbacks.
- The actual shipped game client, with synthetic API responses, updated the relocated countdown and submitted the correct zero-based choices for keys 1, 2, 3 and 4; all four buttons locked after submission. This is client integration evidence, not a real server or production gameplay trial.
- The web edition renders 13 sections without horizontal overflow at all five widths. Its source parity and metadata checks pass; it is deliberately excluded from the indexed sitemap while a draft.
- An 11-page PDF was generated from the same Markdown and visually inspected across all pages. The cover, embedded fonts, readable references and page footers are present; it is marked founder-review draft.
- `git diff --check` passed. No game JavaScript, API handler, deployment configuration, secret, question bank or economic authority changed.

Browser emulation is not physical-phone acceptance. The existing client/server automated regressions remain the application evidence; physical-phone presentation must be accepted after an approved deployment.

## Formal edition revision

The founder requested a more official full draft. Version 1.0 adds the Proof of Learning receipt model, expanded learner journey, editorial lifecycle, raw token unit math, detailed proposed fee and funding logic, payout state/recovery, security boundaries, and a numbered source list. It remains a local publication candidate awaiting founder approval.

## Final polish

The current v1.0 PDF is 13 pages: new cover, clickable contents, 14 bookmarks, two vector figures and two content/specification tables. The web edition uses the same Markdown and SVG figures. Editorial changes tighten repetition without changing selected policy. All PDF pages were visually reviewed; four browser widths, source parity, site and security checks pass. The optional PDF builder requires ReportLab, pypdf and DejaVu fonts. No new release or deployment is claimed.

## Preview preparation after the homepage release

The founder approved preparation of a preview on November 2 (Detroit). Main `ea73348ec325ce6b26f30011e023793a9ae77121` is merged normally into the candidate; both continuity additions are preserved. Fresh full `npm run verify` passes with native Redis 7.4.2 and required Redis modes, including all HQ tests, nine signer checks and all supporting checks. Draft PR, exact published head, preview result and visual acceptance are recorded in the PR release record. Production publication and physical-phone acceptance remain pending.

The homepage-only #227 release is deployed. Read-only follow-up finds apex `/play/` still returns 200 without canonical redirection. Learn's actual target is `/study/`; `/learn/` is not a product route and returns 404 on both domains. Further directory routing remediation is a separate candidate. This whitepaper/timer change retains #227's redirect configuration and all security headers unchanged.

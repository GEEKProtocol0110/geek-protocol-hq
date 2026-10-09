# Community contributions and Hall applications

Founder request: October 8, 2026 (America/Detroit). Public form: `/thanks/#join`. Private review: `/ops/community/`.

Visitors may offer help with questions, testing, artwork, development, community outreach, fund support or another contribution. They may separately request public recognition. Applying requires no player account, wallet connection or donation. The form collects a public display name, optional public profile, contribution description and optional HTTPS evidence link. Applicants are instructed to omit private contact information, documents and wallet secrets. There is no upload or email/DM integration. Actual question submissions retain the existing `/contribute/` workflow.

Recognition requires both a request and explicit consent to publish the public name, profile and an owner-reviewed description. Applications and their evidence remain private. The owner verifies the contribution and public identity, enters a separate public summary, checks the verification confirmation and approves publication. Neither sending funds nor supplying a transaction link automatically proves a contribution or buys recognition. Offers without publication consent can be reviewed and closed but cannot be published. Publication is not a wallet-based identity proof or a guarantee of partnership, compensation or returns.

## Contribution fund

The founder designated this public Kaspa mainnet receiving address and stated that it is held in Kasware:

`kaspa:qpfrn9je94gy0d4j0ymy920a7sgyndel6jtxfzra4w72cxafd0lpwq0k9nvfr`

The existing address validator confirms its mainnet checksum. This does not independently prove custody, ownership, balances or how funds will be spent. The panel displays the full address in a read-only selectable field, supports explicit copying with a manual fallback, and asks visitors to check the network and full address in their own wallet. No QR destination, abbreviated-only destination, asset price, minimum donation, transaction construction, signing or broadcast is added. Accepted token assets beyond the Kaspa network were not separately specified; the page does not invent a token list. Keep this fund distinct from the GEEK deployer, reward reserve and payout destinations.

Fund giving is optional and independent of game rewards, treasury settlement, minting and Hall approval. A future address change needs an explicit founder instruction and reviewed source change. The fund destination never comes from an applicant, URL parameter or browser storage. This release changes no payout gates.

## API, access and storage

The existing session function dispatches `service=community`; no extra serverless function is created. Public GET returns only owner-approved credits, 20 per page, using an explicit allowlist of fields. It cannot retrieve applications by ID. Public POST accepts bounded JSON from a trusted HTTPS site origin; other origins, cross-site requests, non-JSON data, unknown fields, unsafe links and a filled honeypot fail. The server never fetches evidence or profile URLs.

Owner review uses `service=operations&action=community` and the existing current, unexpired owner HttpOnly session. Player cookies and direct CCE/audit/payout keys grant no access. Mutation requires a trusted HTTPS Origin and JSON; owner reads reject an explicitly untrusted Origin/cross-site request. Existing owner key rotation and optional authenticator controls remain effective. Workspace HTML and scripts stay in server-only `ops-ui`, served only after authentication. Private views clear on pagehide, sign-out and failed owner authentication.

Redis keys use `geek:<environment>:community:v1:*`. Pending applications retain private descriptions/evidence for up to 90 days; closed records for 30 days after closure; published applications for 90 days after approval. Approved public credit records remain until owner withdrawal, independently of private application expiry. Old pending-index entries are pruned. Initial capacities are 500 pending applications and 200 public credits. Owner lists use 50-record pages; public lists use 20-record pages. These are capacity limits, not supporter rankings. Correction/removal requests use the existing Geek community contact and application reference. Withdrawal removes a public credit on subsequent page loads; already-open pages refresh to see the change.

Submission limits are three new requests per 10 minutes and twelve per day per existing network/user-agent fingerprint. These are basic abuse controls, not proof of unique humans; shared networks may hit the limit. Opaque IDs derive from a client request ID and fingerprint. Exact retries return the same saved receipt before new-request rate limits. Reusing an ID with changed content conflicts. The browser retains uncertain request data in memory, locks edits and offers an explicit identical receipt retry. Reloading loses this in-memory recovery; contributors should retain a returned reference.

Creation, publication/closure and withdrawal use Lua transitions with Redis type prechecks. Decisions compare the prior record and revision; competing decisions cannot both succeed. Publication writes only the consented public projection. Application/public index changes and an integrity-protected audit event commit together. Audit events contain action types and hashed actor/object identifiers, not applicant prose, profile/evidence links or review notes. Notes remain in the private application until expiry; withdrawal notes are input context rather than a retained public field. Failed storage checks cannot partially publish a credit. Lost decision responses require refreshing the owner list before another decision.

## Validation and limits

Real-Redis tests cover concurrent/repeated submissions, lost-response receipt recovery, validation/consent, private-data projection, owner authorization/rotation/origin checks, concurrent decisions, publication/withdrawal, TTLs, rate limits and storage faults. Client tests check stable retry payloads and safe profile links. Static inspection checks the exact fund address and absence of wallet signing/transaction APIs. Full repository verification and dependency audit are required.

Browser access was previously declined and is not retried. Rendered desktop/mobile layout and keyboard/device acceptance remain outstanding. No production application or real transfer is sent as a test. Storage is required for applications and new credits; static dedications and the fund address remain readable during an outage. New credit history lives in Redis/audit records, while founding dedications remain in Git. Include the new keys in isolated backup/recovery acceptance; production backup coverage remains unverified.

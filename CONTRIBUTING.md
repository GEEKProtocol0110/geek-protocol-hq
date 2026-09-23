# Contributing to Geek Protocol HQ

Thank you for helping build a stronger Proof-of-Learning platform for Kaspa. Contributions are welcome when they preserve the project's security boundaries, evidence standards, and community-first direction.

## Before you start

- Use a GitHub issue for a reproducible bug or a clearly scoped feature proposal.
- Do not open a public issue for an unpatched vulnerability; follow [SECURITY.md](SECURITY.md).
- Keep treasury settlement, reward withdrawals, collection ownership, and other value-moving behavior disabled unless the change is explicitly scoped for independent review.
- Never add seed-phrase collection, private-key handling, browser-owned scores, or public ranked answer keys.

## Development setup

```sh
git clone https://github.com/GEEKProtocol0110/geek-protocol-hq.git
cd geek-protocol-hq
npm ci --ignore-scripts
cp .env.example .env.local
npm run verify
```

Use Node.js 20 or newer. Stateful Alpha features require Upstash Redis credentials. Never use production secrets in local development or commit an environment file containing credentials.

## Pull-request standard

1. Create a focused branch from current `main`.
2. Keep changes small enough to review and explain the trust impact.
3. Add or update tests for every security-relevant or state-changing behavior.
4. Update protocol documentation and `security/controls.json` when an invariant changes.
5. Run `npm run verify` and `npm audit --omit=dev --audit-level=high`.
6. Complete the pull-request checklist without overstating audit or production readiness.

## Code and content principles

- Prefer clear, dependency-light JavaScript and explicit fail-closed behavior.
- Keep ranked authority, secrets, and answer keys in server-only modules.
- Use atomic storage transitions for one-use credentials, inventory, and balances.
- Preserve accessibility, responsive layouts, and keyboard-readable controls.
- Treat community questions and recovered artwork as provenance-bearing content.
- Distinguish planned, implemented, internally verified, and independently audited work.

## Review expectations

Maintainers may request threat-model updates, abuse cases, failure-mode tests, evidence paths, or a narrower change before merging. Passing CI is necessary but does not guarantee acceptance or constitute an independent audit.

By contributing, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md) and license your code contributions under the repository's MIT License.

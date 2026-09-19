# Identity Dependency Provenance

Recorded for the wallet-identity Alpha release. This is review evidence, not a third-party audit or a claim that the package publisher is Kaspa.

## Locked package

| Field | Value |
|---|---|
| npm package | `@dfns/kaspa-wasm` |
| Version | `0.14.1` exact, with no range operator |
| Registry artifact | `https://registry.npmjs.org/@dfns/kaspa-wasm/-/kaspa-wasm-0.14.1.tgz` |
| Lockfile SRI | `sha512-Lv/VkiPkxQgPTRmz2MG/PTNFzL0JuVLxhc9mKKgQbxbuT7XTOzra/AmCJgOBrn0O/A73/0QKAeiBg+1HrQ7ZnA==` |
| Declared source repository | `https://github.com/kaspanet/rusty-kaspa` |
| Declared license | ISC |

The package is installed with `npm ci --ignore-scripts` in CI. It declares no transitive runtime dependencies and includes the Node-compatible JavaScript binding, TypeScript declarations, and WebAssembly module.

## Reviewed installed artifacts

| Artifact | SHA-256 |
|---|---|
| `node_modules/@dfns/kaspa-wasm/kaspa.js` | `ef54144c9827a5705931c42bc923d3a7b778e0babd6d14ed1e7462bdd72ea309` |
| `node_modules/@dfns/kaspa-wasm/kaspa_bg.wasm` | `976932dc84870ef789fbd2697428da0da5c1ac191dfed4b165eb305875b0fe71` |

These hashes describe artifacts produced by the locked npm archive. They do not by themselves prove reproducibility from a particular Rust source commit. An independent reviewer should map the package to a signed upstream release or perform a reproducible build before mainnet settlement.

## APIs used

The application limits use of this package to:

- parsing a compressed secp256k1 public key;
- deriving the corresponding Kaspa mainnet address; and
- verifying a Kaspa Schnorr personal-message signature.

The package is never given a player private key or seed phrase. The browser wallet produces signatures; the server performs the trust decision.

## Release checks

- `package-lock.json` pins the archive URL and integrity digest.
- `npm audit --omit=dev --audit-level=high` blocks known high or critical production dependency findings in CI.
- `npm run security:check` verifies the exact version, lock integrity, server verifier, and deployed WebAssembly inclusion.
- `npm sbom --sbom-format spdx` can generate a release SBOM from the locked graph for the independent reviewer.

Any version change requires new artifact hashes, compatibility tests, dependency review, and independent-audit delta review.

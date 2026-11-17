# Owner authenticator login

Production Operations requires a dedicated owner key **and** a six-digit TOTP code. The existing 30-minute cookie grants the configured workspaces, so the code is not entered again on every page. This is an additional factor for the current owner, not individual staff accounts or hardware-backed, phishing-resistant authentication.

When `VERCEL_ENV=production` or `NODE_ENV=production`, a missing, empty or malformed `OPS_TOTP_SECRET` fails closed. Removing it cannot restore direct role-key access or an older single-factor session. Non-production fixtures may omit MFA; that is not a production recovery path. Every environment requires `OPS_ACCESS_TOKEN`; no CCE fallback remains. In production, that token must also differ from every configured role key.

## Enroll before enabling

1. On a trusted computer with Node installed, run the repository's `scripts/setup-ops-mfa.mjs` with `--out` and an absolute private path outside the checkout. For example: `node scripts/setup-ops-mfa.mjs --out /home/you/private/geek-ops-enrollment.json`. Create the private directory first. The script creates a random setup file, refuses to overwrite it, and prints no secret. Unix permissions are 0600; use your operating system's private-file protection as well.
2. Open that file privately. In an authenticator app supporting standard TOTP, add **Geek Protocol Operations / Owner** using its `secret` value. Select time-based, six digits, SHA-1, and 30 seconds if the app exposes these choices. The file also contains an `otpauth` URI for compatible local import; never use an online QR-code generator or paste it into chat.
3. Store an offline recovery copy securely. Verify you can reopen that copy and still access the Vercel account through its own MFA/recovery method. Keep this recovery material separate from the owner access key.
4. Add that same secret as the **Secret** environment variable `OPS_TOTP_SECRET` in Vercel **Production**, then redeploy. Never use a `NEXT_PUBLIC_` name. Preview enrollment should have a different secret. Do not add it to Git, screenshots, support messages or audit notes.
5. Open `/ops-login/`, enter your existing owner key and the code from the app. Confirm Operations reports **Authenticator enabled** and that all configured workspaces open. Enabling or changing the secret revokes older owner sessions. Do not discard the offline recovery copy after login.

Provision a separate 24–512-character `OPS_ACCESS_TOKEN` before deploying this enforcement change. Keep it distinct from the CCE, audit and payout-review keys. Other role configuration remains server-side; no additional role keys are entered in the browser. This source change does not inspect or provision production secrets. If configuration is missing, public learning remains available while private Operations refuses access.

## Enforcement

Codes use Redis server time with a 30-second period and one step of clock tolerance in either direction. An atomic high-water counter prevents replay and concurrent use; a used or older code is rejected. The replay guard is tied to the authenticator secret, so rotating another role/owner key cannot make a used code valid again. The owner-wide limit is eight well-formed code attempts per minute after the first factor is accepted. Login/logout share ten attempts per network per ten minutes; the three role APIs share sixty requests per network per minute before credential checks, including rejected keys. Network budgets ignore User-Agent and normalize IPv6 to /64; platform client-address headers must be trusted only at the intended proxy boundary. Distributed flooding is not solved by these limits. Audit or session-creation failures can consume a code without completing login: wait for a fresh code and retry manually.

When an authenticator is configured, moderation, audit and payout APIs require the MFA-established owner cookie. Standalone role keys and Authorization headers cannot bypass it, even if valid. Any external callers using those headers must be migrated before activation. These APIs still enforce configured role permissions, trusted origin, JSON mutation requests and session expiry. Secrets and codes are absent from status responses, session records and audit events. The login form clears both fields immediately on submit and never stores them.

The independent-audit gate for individual hardware-backed privileged access remains open. TOTP can be phished; it is not a passkey or proof of who holds the key. Secure the GitHub, Vercel and database accounts separately with their supported MFA.

## Lost phone or lockout

Use the secure offline enrollment copy to add the same authenticator on a replacement device. If compromise is suspected, use the independently secured Vercel account to provision a **new** authenticator secret and rotate the owner key, then redeploy and verify login. For planned rotation, enroll the new secret before replacing the environment value. Removing or blanking it fails closed in production. Never delete the replay guard to reuse a code. See [Backup recovery](BACKUP-RECOVERY.md) for database recovery; the authenticator secret is not in Redis backups.

## Evidence

`tests/operations-mfa.test.js` checks [RFC 4226](https://www.rfc-editor.org/rfc/rfc4226.html) and [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html) vectors, both-factor enforcement, races/replay, clock windows, configuration changes, API bypasses, origin checks, rate limits, unavailable/corrupt storage and private enrollment files. Repository and synthetic browser verification are internal checks. No production secret is generated, inspected or configured by this release.

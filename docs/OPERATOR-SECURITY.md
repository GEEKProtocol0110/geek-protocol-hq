# Owner authenticator login

The sole owner can add an authenticator app to Operations. Login then requires the existing owner key **and** a six-digit TOTP code. The existing 30-minute cookie grants the configured workspaces, so the code is not entered again on every page. This is an additional factor for the current owner, not individual staff accounts or hardware-backed, phishing-resistant authentication.

Deploying the feature does not enable it. While `OPS_TOTP_SECRET` is absent, existing owner access continues and Operations explicitly reports **Authenticator not enabled**. A configured empty or malformed value fails closed.

## Enroll before enabling

1. On a trusted computer with Node installed, run the repository's `scripts/setup-ops-mfa.mjs` with `--out` and an absolute private path outside the checkout. For example: `node scripts/setup-ops-mfa.mjs --out /home/you/private/geek-ops-enrollment.json`. Create the private directory first. The script creates a random setup file, refuses to overwrite it, and prints no secret. Unix permissions are 0600; use your operating system's private-file protection as well.
2. Open that file privately. In an authenticator app supporting standard TOTP, add **Geek Protocol Operations / Owner** using its `secret` value. Select time-based, six digits, SHA-1, and 30 seconds if the app exposes these choices. The file also contains an `otpauth` URI for compatible local import; never use an online QR-code generator or paste it into chat.
3. Store an offline recovery copy securely. Verify you can reopen that copy and still access the Vercel account through its own MFA/recovery method. Keep this recovery material separate from the owner access key.
4. Add that same secret as the **Secret** environment variable `OPS_TOTP_SECRET` in Vercel **Production**, then redeploy. Never use a `NEXT_PUBLIC_` name. Preview enrollment should have a different secret. Do not add it to Git, screenshots, support messages or audit notes.
5. Open `/ops-login/`, enter your existing owner key and the code from the app. Confirm Operations reports **Authenticator enabled** and that all configured workspaces open. Enabling or changing the secret revokes older owner sessions. Do not discard the offline recovery copy after login.

If a dedicated `OPS_ACCESS_TOKEN` is absent, the existing CCE key remains the first factor. Configure a distinct owner key before sharing any moderator key. Other role configuration remains server-side; no additional role keys are entered in the browser.

## Enforcement

Codes use Redis server time with a 30-second period and one step of clock tolerance in either direction. An atomic high-water counter prevents replay and concurrent use; a used or older code is rejected. The replay guard is tied to the authenticator secret, so rotating another role/owner key cannot make a used code valid again. The owner-wide limit is eight well-formed code attempts per minute, alongside the existing client login limit. Changing IP or User-Agent cannot bypass the owner-wide limit. Audit or session-creation failures can consume a code without completing login: wait for a fresh code and retry manually.

When an authenticator is configured, moderation, audit and payout APIs require the MFA-established owner cookie. Standalone role keys and Authorization headers cannot bypass it, even if valid. Any external callers using those headers must be migrated before activation. These APIs still enforce configured role permissions, trusted origin, JSON mutation requests and session expiry. Secrets and codes are absent from status responses, session records and audit events. The login form clears both fields immediately on submit and never stores them.

The independent-audit gate for individual hardware-backed privileged access remains open. TOTP can be phished; it is not a passkey or proof of who holds the key. Secure the GitHub, Vercel and database accounts separately with their supported MFA.

## Lost phone or lockout

Use the secure offline enrollment copy to add the same authenticator on a replacement device. If compromise is suspected, use the independently secured Vercel account to provision a **new** authenticator secret and rotate the owner key, then redeploy and verify login. For planned rotation, enroll the new secret before replacing the environment value. Do not make the variable blank: that fails closed. Removing it disables the second factor and reopens legacy role-key access, so removal is not the normal recovery path. Never delete the replay guard to reuse a code. See [Backup recovery](BACKUP-RECOVERY.md) for database recovery; the authenticator secret is not in Redis backups.

## Evidence

`tests/operations-mfa.test.js` checks [RFC 4226](https://www.rfc-editor.org/rfc/rfc4226.html) and [RFC 6238](https://www.rfc-editor.org/rfc/rfc6238.html) vectors, both-factor enforcement, races/replay, clock windows, configuration changes, API bypasses, origin checks, rate limits, unavailable/corrupt storage and private enrollment files. Repository and synthetic browser verification are internal checks. No production secret is generated, inspected or configured by this release.

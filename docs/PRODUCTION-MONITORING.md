# Production monitoring

The HQ monitor runs twenty **read-only HTTP probes** against the fixed production origin, `https://www.geekprotocol.xyz`. It creates no player session, game entry, review decision or wallet transaction. No owner cookie, API credential, private response body, display name, wallet address or player ID enters its reports.

## Coverage and interpretation

| Surface | Expected evidence |
| --- | --- |
| Home, Study, Play, Royale, Sign-in and widget installation | HTTP 200 HTML with a surface-specific marker |
| Database health | Connected storage response |
| Study catalog | Distinct populated topics, no graded answers or player identifiers, no ranked/reward grant |
| Public Royale discovery | Bounded counts-only waiting-room summaries; an empty list is valid |
| Economy | Planning-only journal; purchases, payouts, burns and signing remain disabled |
| Widget release metadata | Version, bounded size, SHA-256 and the exact canonical release URL |
| Imported review, Testnet pilot and Monitoring pages | Anonymous request receives the private no-store sign-in redirect |
| The same three APIs and scripts | Anonymous request receives HTTP 401 with private no-store headers |

A 200 response alone is insufficient. Redirects are checked directly rather than followed into a successful login page. Each probe has a five-second deadline covering headers and body reading, including a transport that ignores cancellation. Body limits are 384 KB for public pages and 64 KB for API/private responses. Unexpected responses, oversized bodies, timeouts and transport failures are separate report reasons. Only the check identifier, result, HTTP status, elapsed milliseconds and fixed reason category are saved.

These are point-in-time HTTP checks, not measured percentage uptime, load testing, complete gameplay, an APK installation, wallet signing, indexer payout finality, backup recoverability or an independent security audit. Widget metadata coverage does not download or install the APK. Response times are measured from the checking environment, not every player's device.

## Owner desk

Open `/ops/monitor/` using the existing owner login. **Refresh saved history** only reads stored evidence. **Run production check** performs live probes and saves one report. Failed probes are saved as failed evidence; storage errors are shown as unavailable. No absent or corrupted report is treated as a passing check.

The newest twenty-five owner-triggered reports are retained in a bounded Redis list. The list expires seven days after its last write. A snapshot older than fifteen minutes is labeled stale, including while the page remains open; the local aging timer makes no requests. Read timestamps and the failed rows before relying on a result. This UI has no automatic probe retries, credentials in browser storage or analytics.

Owner-triggered probes require a current owner session, trusted HTTPS Origin and JSON. Arbitrary URL or report submissions are rejected. Read access cannot fall back to explicit credential headers. Runs are limited to three per IP fingerprint in ten minutes and one site-wide start every thirty seconds. The short global lock also protects uncertain-response retries. The history save compares that lock before committing; stale jobs cannot overwrite a newer run. Damaged stored evidence fails closed and is preserved for investigation.

## Scheduled runner

`.github/workflows/production-monitor.yml` runs the same probes on the default branch at UTC minutes **7, 22, 37 and 52**, after successful main-branch Security verification, and through GitHub's **Run workflow** action. It has read-only repository permission, pinned action commits, a three-minute job limit and no production credentials or dependency-install step. Jobs do not open issues or send separate emails or messages.

[Open production-monitoring runs](https://github.com/GEEKProtocol0110/geek-protocol-hq/actions/workflows/production-monitor.yml). Each run summary lists every check, its status, response time and fixed reason. Any failed probe sets a nonzero exit status. Normal GitHub failure notifications depend on the owner's account and workflow notification settings; delivery was not configured or proved here.

The scheduled history stays in GitHub and is **separate from the Redis owner history**. GitHub schedules can be delayed or dropped under load and public-repository schedules can be disabled after inactivity. This is not a guaranteed fifteen-minute alert service. A check during a deployment may briefly see the previous version; inspect its failure and run the same checks again after Vercel finishes. No retries hide that first result.

Local commands:

```sh
npm run monitor:production
node scripts/production-monitor.mjs --json
```

The origin is intentionally not configurable. A monitor request cannot be repurposed to read arbitrary internal or external URLs. The script prints no response bodies and makes no writes to production or Operations history.

## Verification

Tests cover fixed-origin credential-free requests, body/transport deadlines, oversized responses, private-route and disabled-payment regressions, outage evidence, stale client displays, authenticated access, global run races, bounded history and preserved corruption. Client fixtures exercise the shipped client behavior; they do not establish rendered phone acceptance.

Primary scheduling and summary behavior follows [GitHub workflow events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) and [job summaries](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary). No separate signing service, messaging service or paid uptime product is introduced.

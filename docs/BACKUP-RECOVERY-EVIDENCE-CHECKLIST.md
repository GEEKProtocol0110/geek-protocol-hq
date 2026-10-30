# Backup and recovery evidence checklist (OPS-001 / CONT-002)

This checklist **keeps DR-028**: the free database plan, daily backups off, and manual exports. **Do not enable paid or automatic backups.** Record evidence privately, by role and outcome. Never put identifiers, hosts, credentials or player data in this public repo. The procedure is in [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md); this page lists what evidence closes each item.

| # | Evidence item | Owner | Status Oct 30 | Closes when |
| --- | --- | --- | --- | --- |
| 1 | Manual provider export, isolated local restore | Founder export; maintainer drill | **Done Oct 25** (format/load passed; the exporter disabled its embedded RDB checksum) | — (preserve; do not repeat) |
| 2 | Fresh manual export before #200 cutover and after any important payout test | Founder | Open | Private note: date/time, file digest, who holds it |
| 3 | Independent source copy (`npm run continuity:snapshot`) | Founder or custodian | Open (CONT-002) | Bundle stored at a **separately controlled** destination; a restore matches the Git tree and bundle digest |
| 4 | Private bank repository copy | Founder | Open (after INFRA-001) | A clone or bundle of the private repo held off-GitHub; restore verified by SHA |
| 5 | Managed-provider restore into a **new isolated** database | Founder | Open | Source and destination recorded privately; representative records verified (steps 2–4 of the provider restore) |
| 6 | Session/challenge revocation on the restored copy (`reset-restored-sessions.mjs`, dry run then `--apply`) | Maintainer with founder | Open | Counts recorded; old cookies rejected |
| 7 | Protected application recovery deployment | Founder | Open | Sign-in, saved progress, owner workspaces, audit integrity and free gameplay checked; **payouts disabled** confirmed |
| 8 | Measured recovery time and data-loss window | Founder | Open | Compared to the proposed 24 h loss / 4 h recovery objectives (objectives only) |
| 9 | Vercel environment and secret inventory (names only) | Founder | Open | Private list of which environments hold which variable *names*. Rotation plan for `OPS_ACCESS_TOKEN` and the private-bank token |
| 10 | Account-access recovery (GitHub, Vercel, database provider) | Founder | Open (OPS-002: no second trusted administrator appointed) | Recovery methods confirmed privately |

**Out of scope:** paid backup tiers, in-place production restore, and clearing a live database. A Redis `PING` or a successful Git clone is not recovery evidence.

# Arcade glow design preview

**Retired.** UX-031 (#297) applied this direction to the real `/games/` hub with all 24 modes. The concept files were removed and `/games/preview/` (and anything below it) now 308-redirects to `/games/` via `vercel.json`, so the stale mockup is no longer served. The text below is the historical record.

UX-030. A separate noindex `/games/preview/` route lets the founder inspect the proposed teal/gold Arcade design using the normal HQ Vercel branch preview. The earlier private Sites demo required a separate ChatGPT login and is not the Geek release workflow.

The current Games hub is unchanged. The preview reuses the existing GIGA app asset, self-hosted CSS and JavaScript, system fonts, existing CSP, responsive cards, reduced-motion support, filters and search. Memory and local tic-tac-toe are explicitly session-only demos. Backgammon is a nonplayable design concept. Practice links use the existing HQ route; no new quiz answer bank is public. No account, wallet, multiplayer, reward or provider setting changes.

Draft only. No merge or production release is authorized by requesting a preview. Browser/physical-phone acceptance and eventual integration are separate. Validation and exact deployment evidence are recorded in the PR.

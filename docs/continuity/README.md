# Project memory and continuation

The front door is [Start Here](../../START-HERE.md). This directory holds current state, decisions, work and evidence in portable files so the project can continue beyond any one chat, tool or contributor.

## Maintained records

| Record | Source | Readable view |
| --- | --- | --- |
| Product checkpoint and next action | [project.json](project.json) | [Current state](CURRENT-STATE.md) |
| Tasks, dependencies and acceptance | [backlog.json](backlog.json) | [Backlog](BACKLOG.md) |
| Decisions and unresolved questions | [decisions.json](decisions.json) | [Decisions](DECISIONS.md) |
| Historical merged changes | [releases.json](releases.json), [commits.json](commits.json) | [History](HISTORY.md) |
| Public component directory | [repositories.json](repositories.json) | [Repositories](REPOSITORIES.md) |
| Originals and preservation gaps | [assets.json](assets.json) | [Asset register](ASSET-REGISTER.md) |

`npm run continuity:write` refreshes bank/Study/Quest counts from local code and regenerates these views. It does not certify production or mark work complete. `npm run continuity:check` detects stale views/counts, missing references, broken dependencies and changed preserved-original hashes.

## Direction and delivery

Read the [fifty-year vision](VISION-2076.md), [institutional path](INSTITUTIONAL-PATH.md), [pilot charter](PILOT-CHARTER.md), [partner brief](PARTNER-BRIEF.md), [operating guide](OPERATING-GUIDE.md), [succession guide](SUCCESSION.md), [archive guide](ARCHIVE-GUIDE.md), [official research sources](SOURCES.md), and [work log](WORKLOG.md).

The system improves preservation and pickup; no repository can guarantee permanent availability. Independent copies and exercised recovery remain explicit work. Historical source documents are archived evidence of earlier ideas, not current technical or legal claims.

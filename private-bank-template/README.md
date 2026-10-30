# Private ranked bank — repository template (FAKE EXAMPLE ROWS ONLY)

This folder shows the layout of the **separate private repository** that will hold
future ranked questions. Every row here is fake (`"example": true`, prompt starts
with `EXAMPLE —`). **Never commit real ranked questions to this public repository.**
The `TEMPLATE` marker file makes the tooling enforce example-only rows here.

```
<private-repo>/
  manifest.json                 immutable version manifest (generated)
  bank/<category>.json          active, selectable rows   { "questions": [...] }
  bank/<category>-retired.json  lookup-only rows: grade saved runs, never selected
```

`GEEK_PRIVATE_QUESTION_DIR=<private-repo>/bank` reads this layout directly; the built document is the `GEEK_PRIVATE_QUESTION_URL` format.

Categories: the keys of `categoryFiles` in `server/question-categories.js`.
IDs: `PRK-<CAT>-<YYYYMM>-<NNNN>`, never reused (also across retired rows).

## Workflow (run from a checkout of this public repo)

```sh
node scripts/private-bank.mjs check    ../private-bank         # schema + duplicates (also vs public banks) + manifest current
node scripts/private-bank.mjs manifest ../private-bank --write --commit <40-hex sha of previous commit, optional>
node scripts/private-bank.mjs build    ../private-bank --out /tmp/ranked-bank.json
```

Versioning rules:
- A published version is immutable. Change rows → regenerate `manifest.json` → new `sha256:` version
  → new commit; point `GEEK_PRIVATE_QUESTION_REF` at that commit SHA.
- Retire a row by **moving** it to `<category>-retired.json` with `retiredReason` and `retiredAt`.
  Retired rows stay forever so in-flight and saved runs bound to old versions still grade.
- Prompts that ever appeared in the public repo are rejected as exposed.

See `docs/MIGRATION-private-ranked-bank.md`.

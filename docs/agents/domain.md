# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout

This repo uses a **single-context** layout for the hotpot ordering demo. The React frontend and demo server share the same domain glossary and architecture decision records.

- **`GLOSSARY.md`** at the repo root: shared domain terminology.
- **`docs/adr/`**: architecture decision records.

## Before exploring, read these

- Read the root `GLOSSARY.md`.
- Read ADRs under `docs/adr/` that touch the area you are about to work in.

If these files do not exist, **proceed silently**. Do not flag their absence or suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

```text
/
├── GLOSSARY.md
├── docs/adr/
├── src/                 # React frontend
└── server/src/          # Demo server
```

The glossary and ADR entries are created when needed; this setup does not create empty placeholders.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, or a test name), use the term as defined in `GLOSSARY.md`. Do not drift to synonyms the glossary explicitly avoids.

If the concept you need is not in the glossary yet, reconsider whether you are inventing language the project does not use, or note a real gap for `/domain-modeling`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding it. Identify the ADR and explain why the decision may need to be reopened.

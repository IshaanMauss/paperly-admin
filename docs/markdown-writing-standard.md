# Markdown Writing Standard

This standard applies to every Markdown document in this repository.

## Purpose

Keep technical, operational and product documentation consistent, searchable and easy to maintain, regardless of who writes or updates it.

## Document structure

Use the following structure when the document describes a system, workflow or project record:

```markdown
# Document title

Purpose: one sentence describing the document's scope.

## Current state

Describe behaviour, configuration or decisions that are true now.

## History

### YYYY-MM-DD

- Change, decision or verification result.
- Impact or follow-up, when needed.
```

Not every document needs every section. Short records may contain only a purpose and dated entries. Reference documents should keep current behaviour separate from history.

## Dates and history

- Use ISO dates: `YYYY-MM-DD`.
- Put the newest history entry first.
- Keep one aggregated history section per document.
- Do not repeat the same change in multiple dated entries.
- Record what changed, why it changed and how it was verified.
- Mark uncertain information as `NOT CHECKABLE` or `UNCONFIRMED`; do not present assumptions as facts.
- Move obsolete records to an explicitly marked `Historical` section or remove them from active documentation.

## Language and tone

- Use direct, neutral, technical language.
- Prefer short sentences and concrete verbs.
- Avoid personal names and personal attribution in technical history.
- Do not mention AI assistants or coding tools by name in project records.
- Avoid first-person language in technical documentation.
- Avoid conversational second-person language in internal engineering records. Use user-facing `you` only when the document is an actual user guide.
- Define an abbreviation the first time it appears.
- Use the product's approved names consistently.

## Status vocabulary

Use these status words exactly and define the meaning when a document introduces them:

- `DONE`: implemented and verified.
- `PARTLY`: implemented with a known limitation.
- `OPEN`: not implemented or still requires work.
- `OWNER`: requires an account, hosting or configuration action outside the repository.
- `NOT CHECKABLE`: cannot be confirmed from the available repository or test environment.
- `HISTORICAL`: retained for context and not a current source of truth.

## Source of truth

- Each technical fact should have one authoritative document.
- Other documents should link to that source instead of copying a long explanation.
- Keep README files concise and introductory.
- Keep architecture files focused on current structure.
- Keep changelogs and project-history files focused on dated changes.
- Keep operational checklists focused on actions and release conditions.
- Do not mix production results, planned work and historical observations without labels.

## Accuracy and safety

- Do not include passwords, API keys, tokens, private personal data or full connection strings.
- Use placeholders such as `<redacted>` when an example is necessary.
- Include repository-relative file paths and, when useful, line references.
- State whether a result was read-only, tested locally, applied to test or applied to production.
- Do not claim that a deployment, migration or test happened without evidence.
- Update related documentation when a documented route, setting, status or workflow changes.

## Review checklist

Before committing a Markdown change, confirm:

- The title and purpose match the actual scope.
- Current state and history are separated.
- Dates use `YYYY-MM-DD`.
- No duplicate history entry was added.
- No personal name, AI-tool name, secret or unsupported claim was introduced.
- Status words use the approved vocabulary.
- Repeated technical facts link to their source of truth.
- File paths, commands and route names are accurate.
- The document still matches the code or explicitly states what cannot be checked.

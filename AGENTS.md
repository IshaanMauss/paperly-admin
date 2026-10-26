# Agent instructions

Purpose: Rules that apply to anyone, human or tool, who edits this repository.

## Documentation rules

Every Markdown file follows `docs/markdown-writing-standard.md`: purpose line, current state kept apart from history, ISO dates (`YYYY-MM-DD`) with the newest entry first, one aggregated history section per document, no personal or tool names, no first-person wording, no secrets, and one source of truth per fact.

Before committing any Markdown change run `python scripts/check_markdown_docs.py --strict`. It must report 0 errors. The same check runs from `.githooks/pre-commit` (enable once with `git config core.hooksPath .githooks`).

#!/usr/bin/env python3
"""Checks every Markdown file in the repository against docs/markdown-writing-standard.md.

Usage:
    python scripts/check_markdown_docs.py            # report only, always exits 0
    python scripts/check_markdown_docs.py --strict   # exits 1 when any ERROR is found
    python scripts/check_markdown_docs.py --warnings # also list WARN findings

ERROR: personal or assistant names, first-person wording, non-ISO dates, secrets, duplicate dated headings,
       duplicate history bullets, history entries that are not newest first.
WARN : conversational second person ("you", "your"), a missing "Purpose:" line in docs/*.md.

Folders named _to_delete* and node_modules are outside the scope. Fenced code and inline code are ignored.
"""
from __future__ import annotations

import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_PARTS = {"node_modules", ".git", ".next", "venv", ".venv"}
NAMES = r"claude|codex|chatgpt|copilot|toyaj|ishaan|ishaa|anand|satyam|shraddha"
RULES = [
    ("name", re.compile(rf"\b({NAMES})\b", re.I), "personal or assistant name"),
    ("first-person", re.compile(r"(?<![-\w])(I|I'm|I've|I'll|I'd|we|we're|we've|we'll|our|ours|us|my|mine|me)\b"), "first-person wording"),
    ("date-style", re.compile(
        r"\b(?:\d{1,2}[/-]\d{1,2}[/-](?:20)?2\d\b"
        r"|\d{4}-\d{2}-\d{2}/\d{2}\b|\d{4}-\d{2}/\d{2}\b"
        r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.? \d{1,2}(?:st|nd|rd|th)?\b(?!:)"
        r"|\d{1,2}(?:st|nd|rd|th)? (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b)"), "date not written as YYYY-MM-DD"),
]
SECRETS = [
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"), re.compile(r"\beyJ[A-Za-z0-9_-]{30,}"),
    re.compile(r"postgres(?:ql)?://[^\s:/<]+:[^\s@<]+@"), re.compile(r"\brzp_(?:live|test)_[A-Za-z0-9]{8,}"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
]
WARN_RULES = [("second-person", re.compile(r"\b(you|your|yours|you're|you'll|you've)\b", re.I), "conversational second person")]
ISO_HEADING = re.compile(r"^(#{2,4})\s+(\d{4}-\d{2}(?:-\d{2})?)(?!\d)")
MONTH_HEADING = re.compile(r"^#{2,4}\s+.*\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b(?:\s+\d{4})?")


def files() -> list[Path]:
    out = subprocess.run(["git", "ls-files", "-co", "--exclude-standard", "*.md"], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
    result = []
    for rel in out:
        if not rel:
            continue
        parts = Path(rel).parts
        if any(p in SKIP_PARTS or p.startswith("_to_delete") for p in parts):
            continue
        if (ROOT / rel).is_file():
            result.append(Path(rel))
    return result


def strip_code(text: str) -> list[tuple[int, str]]:
    lines, fenced = [], False
    for number, line in enumerate(text.split("\n"), 1):
        if line.lstrip().startswith("```"):
            fenced = not fenced
            continue
        if fenced:
            continue
        clean = re.sub(r"\]\([^)]*\)", "]", line)
        clean = re.sub(r"`[^`]*`", "", clean)
        clean = re.sub(r'"[^"]*"|\u201c[^\u201d]*\u201d', "", clean)  # quoted interface text is quoted as written
        lines.append((number, clean))
    return lines


def check(path: Path):
    errors, warns = [], []
    text = (ROOT / path).read_text(encoding="utf-8", errors="replace")
    body = strip_code(text)
    for number, line in body:
        for tag, rx, label in RULES:
            for m in rx.finditer(line):
                errors.append((number, tag, f"{label}: {m.group(0)!r}"))
        for tag, rx, label in WARN_RULES:
            for m in rx.finditer(line):
                warns.append((number, tag, f"{label}: {m.group(0)!r}"))
    for number, line in enumerate(text.split("\n"), 1):
        for rx in SECRETS:
            if rx.search(line):
                errors.append((number, "secret", "possible secret or connection string"))
    headings = [(n, m.group(2)) for n, line in body if (m := ISO_HEADING.match(line))]
    seen = Counter(h for _, h in headings)
    for n, h in headings:
        if seen[h] > 1:
            errors.append((n, "duplicate-heading", f"dated heading {h} appears {seen[h]} times"))
    stack: list[tuple[int, str]] = []
    siblings: dict[tuple, list[tuple[int, str]]] = defaultdict(list)
    for n, line in body:
        hm = re.match(r"^(#{1,6})\s+(.*)", line)
        if not hm:
            continue
        level = len(hm.group(1))
        while stack and stack[-1][0] >= level:
            stack.pop()
        m = ISO_HEADING.match(line)
        if m:
            siblings[tuple(stack)].append((n, m.group(2)))
        elif MONTH_HEADING.match(line) and not re.match(r"^#\s", line):
            errors.append((n, "month-heading", "month name in heading; use YYYY-MM or YYYY-MM-DD"))
        stack.append((level, hm.group(2)))
    for items in siblings.values():
        for (n1, a), (n2, b) in zip(items, items[1:]):
            if b > a:
                errors.append((n2, "order", f"history not newest first ({b} after {a})"))
    bullets = Counter(re.sub(r"\s+", " ", line.strip().lstrip("-*").strip().lower()) for _, line in body if re.match(r"\s*[-*]\s+\S{12,}", line))
    for n, line in body:
        if re.match(r"\s*[-*]\s+\S{12,}", line):
            key = re.sub(r"\s+", " ", line.strip().lstrip("-*").strip().lower())
            if bullets[key] > 1 and len(key) > 40:
                errors.append((n, "duplicate-bullet", "same bullet appears more than once in this file"))
                bullets[key] = 0
    if path.parts[0] == "docs" and len(path.parts) == 2 and path.name != "markdown-writing-standard.md" and not re.search(r"^Purpose:", text, re.M):
        warns.append((1, "purpose", "no 'Purpose:' line"))
    return errors, warns


def main() -> int:
    strict, show_warn = "--strict" in sys.argv, "--warnings" in sys.argv
    total_e = total_w = 0
    per_file = []
    for path in files():
        e, w = check(path)
        total_e += len(e)
        total_w += len(w)
        if e or (show_warn and w):
            per_file.append((path, e, w))
    for path, e, w in per_file:
        print(f"\n{path}  ({len(e)} errors, {len(w)} warnings)")
        for n, tag, msg in e[:40]:
            print(f"  ERROR {n}: [{tag}] {msg}")
        if show_warn:
            for n, tag, msg in w[:20]:
                print(f"  WARN  {n}: [{tag}] {msg}")
    print(f"\n{len(files())} files checked: {total_e} errors, {total_w} warnings")
    return 1 if strict and total_e else 0


if __name__ == "__main__":
    sys.exit(main())

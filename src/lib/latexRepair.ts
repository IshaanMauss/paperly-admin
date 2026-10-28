// LaTeX text-repair helpers, extracted from templatePresentation.ts
// (2026-09-28, pure code motion, no behavior change). Flagged by the
// 2026-09-26 design-system audit as one of four unrelated concerns living in
// one 597-line file; this is the piece already covered by
// templatePresentation.test.ts's LaTeX-repair test cases (added 2026-09-28,
// commit a58ea38), which still import from "./templatePresentation" - that
// file now re-exports everything below unchanged.

const LATEX_COMMAND_ARGUMENTS = new Set([
  "pmatrix",
  "bmatrix",
  "matrix",
  "array",
  "cases",
  "aligned",
  "align",
  "gathered",
  "smallmatrix",
  "mathbf",
  "mathit",
  "mathrm",
  "text",
  "frac",
  "sqrt",
  "overrightarrow",
  "vec",
]);

export function isLatexCommandArgument(name: string, offset: number, source: string) {
  const before = source.slice(Math.max(0, offset - 24), offset);
  return /\\(?:begin|end)$/.test(before) || /\\[A-Za-z]+$/.test(before) || LATEX_COMMAND_ARGUMENTS.has(name);
}

export function protectLatexCommandArguments(text: string) {
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, name, offset, source) => isLatexCommandArgument(name, offset, source) ? `@@LATEX_LBRACE@@${name}@@LATEX_RBRACE@@` : match);
}

export function restoreLatexCommandArguments(text: string) {
  return text.replace(/@@LATEX_LBRACE@@/g, "{").replace(/@@LATEX_RBRACE@@/g, "}");
}

export function repairMalformedLatex(text: string) {
  return text
    .replace(/\\(begin|end)<([A-Za-z*]+)>/g, "\\$1{$2}")
    .replace(/\\(mathbf|mathit|mathrm|text|overrightarrow|vec)<([^<>]+)>/g, "\\$1{$2}");
}

// Apply a clean-up only to the text OUTSIDE well-formed $...$ spans. Stray "$" signs are
// still repaired, but a correctly written "$\\sqrt[4]{y}$, work out $n$." is left untouched
// (before this, its "$" before \\sqrt and before "," or "." were deleted and the maths broke).
export function mapOutsideMathSpans(text: string, fn: (prose: string) => string) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(/\$[^$\n]+\$/g)) {
    const at = m.index ?? 0;
    out += fn(text.slice(last, at)) + m[0];
    last = at + m[0].length;
  }
  return out + fn(text.slice(last));
}

export function wrapRenderableLatex(text: string) {
  return mapOutsideMathSpans(repairMalformedLatex(text), (prose) =>
    prose
      .replace(/\$(?=\\(?:begin|overrightarrow|vec|frac|sqrt))/g, "")
      .replace(/(\\end\{[A-Za-z*]+\})\$/g, "$1")
      .replace(/(\\(?:overrightarrow|vec)\{[^{}]+\})\$/g, "$1")
      .replace(/\$([.,;:!?)]|$)/g, "$1"),
  );
}

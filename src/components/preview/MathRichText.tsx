import katex from "katex";
import { mapOutsideMathSpans } from "@/lib/latexRepair";
import { braceScripts, spaceAroundMath } from "@/lib/mathStyle";

// A braced group that may hold up to TWO levels of inner braces, e.g. {5}, {{5}} or {{\sqrt{2}}}.
// Mark schemes are written as \frac{{{a}}}{{{b}}} (format-style escaping), so plain
// [^{}]+ groups missed them and the raw LaTeX showed on screen.
const BRACED = String.raw`\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})+\}`;
const LATEX_TOKEN_PATTERN = new RegExp(
  [
    String.raw`\$[^$\n]+\$`,
    String.raw`\\begin\{[pb]?matrix\}[\s\S]*?\\end\{[pb]?matrix\}`,
    String.raw`\\overrightarrow\{[^{}]+\}`,
    String.raw`\\vec\{[^{}]+\}`,
    String.raw`\\frac${BRACED}${BRACED}`,
    String.raw`\\sqrt(?:\[[^\]]+\])?${BRACED}`,
    // Set notation and dots outside $...$: \{4, 16\} and \ldots
    // A bare power outside $...$, e.g. 64^x or 2^{n+1}
    String.raw`\b[A-Za-z0-9]+\^(?:\{[^{}]+\}|-?[A-Za-z0-9]+)`,
    String.raw`\\[{}]`,
    String.raw`\\(?:ldots|dots|cdots)`,
  ].join("|"),
  "g",
);

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function repairMalformedLatex(value: string): string {
  return String(value || "")
    .replace(/\\(begin|end)<([A-Za-z*]+)>/g, "\\$1{$2}")
    .replace(/\\(mathbf|mathit|mathrm|text|overrightarrow|vec)<([^<>]+)>/g, "\\$1{$2}");
}

function removeUnsafeMathDelimiters(value: string): string {
  // Only touch text outside well-formed $...$ spans, so correct maths keeps its "$".
  return mapOutsideMathSpans(value, (prose) =>
    prose
      .replace(/\$(?=\\(?:begin|overrightarrow|vec|frac|sqrt))/g, "")
      .replace(/(\\end\{[A-Za-z*]+\})\$/g, "$1")
      .replace(/(\\(?:overrightarrow|vec)\{[^{}]+\})\$/g, "$1")
      .replace(/\$([A-Za-z0-9]+(?:\^\{[^{}]+\}|\^[A-Za-z0-9]+)?(?:\([^$\n]*\))?(?:\s*[=+\-*/]\s*[^$\n.,;:!?]+)*)(?=\s*[.,;:!?]|\s*$)/g, "$1"),
  );
}

// Stored question text is not always tidy: "$$x$$", a "$" that opens maths and never closes
// ("Solve $ 64^x = 32."), or a lone "$" that is a currency sign ("$4000"). Make the delimiters
// balanced so the maths renders instead of showing the raw "$".
const CURRENCY_MARK = "\uE000";
function balanceKeepingCurrency(value: string): string {
  let text = String(value || "").replace(/\$\$([^$]+?)\$\$/g, "$$$1$$").replace(/\\\$/g, CURRENCY_MARK);
  const count = (text.match(/\$/g) || []).length;
  if (count % 2 === 1) {
    const at = text.lastIndexOf("$");
    const tail = text.slice(at + 1);
    if (/^\s*\d/.test(tail) && !/[\^=\\<>_]/.test(tail)) {
      text = text.slice(0, at) + CURRENCY_MARK + tail;
    } else {
      const trailing = /[.,;:!?]+\s*$/.exec(tail);
      const body = trailing ? tail.slice(0, trailing.index) : tail;
      text = text.slice(0, at) + "$" + body.trim() + "$" + (trailing ? trailing[0] : "");
    }
  }
  return text.trim();
}

export function balanceMathDelimiters(value: string): string {
  return balanceKeepingCurrency(value).split(CURRENCY_MARK).join("$");
}

// Some stored templates carry a doubled backslash before a LaTeX command ("p^{1} \\\\times p^{1}"), which used to show
// as a stray red backslash and a bare sign on the picker cards. Collapse it back to one backslash. Only known maths
// commands are touched, so a real row break "\\\\" in a matrix is left alone.
const DOUBLED_COMMAND = /\\\\(times|div|pm|cdot|leq?|geq?|circ|pi|theta|alpha|beta|sqrt|frac|ldots|dots|cdots|degree|mathrm|mathbf|text|vec|overrightarrow)(?![A-Za-z])/g;

export function collapseDoubledBackslashes(value: string): string {
  return String(value || "").replace(DOUBLED_COMMAND, "\\$1");
}

// One pass over the text: a finished $...$ maths span, or a "cm^2" / "m^3" style unit written outside maths.
const MATH_OR_UNIT_POWER = /(\$[^$]*\$)|(?<![A-Za-z])(cm|(?<=\d\s?)m)\^([23])(?![\d{])/g;

function normalizePreviewText(value: string): string {
  return removeUnsafeMathDelimiters(repairMalformedLatex(balanceKeepingCurrency(collapseDoubledBackslashes(value))))
    .replace(/\^\\circ/g, "°")
    .replace(/\\circ/g, "°")
    .replace(/\\leq?/g, "≤")
    .replace(/\\geq?/g, "≥")
    .replace(/\\times/g, "×")
    .replace(/\\div/g, "÷")
    .replace(/\\pm/g, "±")
    // An exponent of two or more digits without braces ("x^132") would raise only its first digit in KaTeX.
    .replace(/\^[ \t]?[-+\u2212]?\d+(?:\.\d+)?(?!\d)/g, (power) => braceScripts(power))
    .replace(MATH_OR_UNIT_POWER, (whole, math: string | undefined, unit: string | undefined, power: string | undefined) => {
      // Outside maths ("5 cm^2" in a sentence) a plain superscript character reads best.
      if (unit) return unit + (power === "2" ? "²" : "³");
      // Inside maths every single-digit exponent gets braces, the same as the longer ones above, so "m^2", "m^{2}" and
      // "x^-2" all reach KaTeX in one shape (it raises only one character after a bare ^).
      return math ? braceScripts(math, { subscripts: true }).replace(/\^(-?\d)(?!\d|\.\d)/g, "^{$1}") : whole;
    })
    .replace(/\\n/g, "\n")
    .replace(/\s+(Key:\s*)/gi, "\n\n$1")
    .replace(/(represents\s*\d+\s*g)\s*(Find\b)/gi, "$1\n\n$2")
    .replace(/\s+(\([a-zivx]+\)\s*)/gi, "\n$1")
    .replace(/([.!?])\s+(Find\b|Calculate\b|Work out\b|Give your answer\b)/g, "$1\n$2")
    .replace(/\s+([.,;])/g, "$1")
    .replace(/\s+(:)(?!\s*[\d$\\])/g, "$1")
    .replace(/([.!?])(?=[A-Z])/g, "$1 ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function normalizeAndSpace(value: string): string {
  return spaceAroundMath(normalizePreviewText(value)).replace(/[ \t]{2,}/g, " ");
}

function renderLatexToken(token: string): string {
  const latex = token.startsWith("$") && token.endsWith("$") ? token.slice(1, -1) : token;

  try {
    return katex.renderToString(latex.trim(), {
      throwOnError: false,
      displayMode: false,
      trust: false,
    });
  } catch {
    return escapeHtml(token);
  }
}

export function renderMixedMath(value: string): string {
  const normalized = normalizeAndSpace(value);
  let output = "";
  let lastIndex = 0;

  for (const match of normalized.matchAll(LATEX_TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index ?? 0;
    const prose = normalized.slice(lastIndex, index);

    output += escapeHtml(prose).replace(/\n/g, "<br />");
    output += renderLatexToken(token);
    lastIndex = index + token.length;
  }

  output += escapeHtml(normalized.slice(lastIndex)).replace(/\n/g, "<br />");
  return output.split(CURRENCY_MARK).join("$");
}

export function MathRichText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMixedMath(text || "") }}
    />
  );
}

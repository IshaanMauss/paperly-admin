// House style for maths in question text: one rule, mirrored from the backend (app/services/math_text_style.py).
// KaTeX raises/lowers only ONE character after a bare ^ or _, so "x^13" would show x¹3. Any exponent with
// two or more digits, a decimal point or a sign must be braced; a plain single digit is left alone.

const EXPONENT = /\^[ \t]?([-+\u2212]?)(\d+(?:\.\d+)?)(?!\d)/g;
const SUBSCRIPT = /_(\d{2,})(?!\d)/g;

export function braceScripts(text: string, options: { subscripts?: boolean } = {}): string {
  let out = String(text || "").replace(EXPONENT, (whole, sign: string, digits: string) => {
    if (sign || digits.length >= 2 || digits.includes(".")) {
      return `^{${sign === "\u2212" ? "-" : sign}${digits}}`;
    }
    return whole.replace(/^\^[ \t]/, "^");
  });
  if (options.subscripts) out = out.replace(SUBSCRIPT, "_{$1}");
  return out;
}

const SUFFIX_AFTER_MATH = /^(?:th|st|nd|rd|s)\b|^['\u2019]/;

// Word/maths gaps: "find$f(x)$and" -> "find $f(x)$ and"; units ("cm$^2$"), ordinals ("$n$th") and "$x$-axis" stay glued.
export function spaceAroundMath(text: string): string {
  const parts = String(text || "").split(/(\$[^$\n]+\$)/);
  if (parts.length < 3) return text;
  for (let i = 0; i < parts.length; i += 2) {
    let piece = parts[i];
    const hasMathBefore = i > 0;
    const hasMathAfter = i + 1 < parts.length;
    if (hasMathAfter && /[A-Za-z]{2,}$/.test(piece) && !/^\$[\^_]/.test(parts[i + 1])) {
      piece += " ";
    }
    if (hasMathBefore && /^[A-Za-z]{2,}/.test(piece) && !SUFFIX_AFTER_MATH.test(piece)) {
      piece = " " + piece;
    }
    if (hasMathBefore && hasMathAfter && piece === ",") piece = ", ";
    parts[i] = piece;
  }
  return parts.join("");
}

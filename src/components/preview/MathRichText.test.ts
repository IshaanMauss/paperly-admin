import { describe, expect, it } from "vitest";
import { balanceMathDelimiters, collapseDoubledBackslashes, renderMixedMath } from "./MathRichText";

describe("balanceMathDelimiters", () => {
  it("closes a dollar that opens maths and never closes", () => {
    expect(balanceMathDelimiters("Solve $ 64^x = 32.")).toBe("Solve $64^x = 32$.");
  });

  it("turns display delimiters into inline ones", () => {
    expect(balanceMathDelimiters("$$m \\ge 3.2$$")).toBe("$m \\ge 3.2$");
  });

  it("leaves a currency sign alone", () => {
    expect(balanceMathDelimiters("Invest $4000 for 7 years")).toBe("Invest $4000 for 7 years");
  });

  it("leaves balanced maths alone", () => {
    expect(balanceMathDelimiters("Find $x$ when $25^x = 5$.")).toBe("Find $x$ when $25^x = 5$.");
  });
});

describe("renderMixedMath", () => {
  it("renders an unclosed dollar as maths with no raw dollar left", () => {
    const html = renderMixedMath("Solve $ 64^x = 32.");
    expect(html).toContain("katex");
    expect(html.replace(/<[^>]+>/g, "")).not.toContain("$");
  });

  it("renders a bare power outside dollars", () => {
    expect(renderMixedMath("Evaluate 2^{n+1} when n = 3")).toContain("katex");
  });

  it("keeps a currency dollar as a dollar", () => {
    expect(renderMixedMath("Invest $4000 for 7 years").replace(/<[^>]+>/g, "")).toContain("$4000");
  });
});

describe("doubled backslashes from stored templates", () => {
  it("collapses a doubled backslash before a maths command", () => {
    expect(collapseDoubledBackslashes("$p^{2} \\\\times p^{3}$")).toBe("$p^{2} \\times p^{3}$");
    expect(collapseDoubledBackslashes("$m^{5} \\\\div m^{2}$")).toBe("$m^{5} \\div m^{2}$");
  });

  it("leaves a real matrix row break and single backslashes alone", () => {
    expect(collapseDoubledBackslashes("1 & 2 \\\\ 3 & 4")).toBe("1 & 2 \\\\ 3 & 4");
    expect(collapseDoubledBackslashes("$a \\times b$")).toBe("$a \\times b$");
  });

  it("renders the picker sample without a stray backslash or red error text", () => {
    const html = renderMixedMath("(a) $p^{1} \\\\times p^{1}$");
    expect(html).not.toContain("katex-error");
    expect(html).not.toContain("\\\\");
    expect(html).toContain("×");
  });
});

describe("exponents of two or more digits", () => {
  it("raises every digit, not only the first", () => {
    // KaTeX raises one character after a bare ^, so "x^132" used to show a small 1 then a normal 32.
    expect(renderMixedMath("Write $(64x^132)^{4/6}$ in its simplest form.")).toBe(renderMixedMath("Write $(64x^{132})^{4/6}$ in its simplest form."));
    expect(renderMixedMath("$p^14$")).toBe(renderMixedMath("$p^{14}$"));
    expect(renderMixedMath("$m^2$")).toBe(renderMixedMath("$m^{2}$"));
    expect(renderMixedMath("$x^2 + y^3$")).toBe(renderMixedMath("$x^{2} + y^{3}$"));
    expect(renderMixedMath("$x^-2$")).toBe(renderMixedMath("$x^{-2}$"));
  });

  it("writes units outside maths with a superscript character and never leaks a caret or a brace", () => {
    expect(renderMixedMath("The area is 5m^2 and the volume is 12 cm^3.")).toBe("The area is 5m² and the volume is 12 cm³.");
    const html = renderMixedMath("Find $m^2$ when the area is 9 cm^2 and $y^{-1}$ is 4.");
    const visible = html.replace(/<annotation[\s\S]*?<\/annotation>/g, "").replace(/<[^>]+>/g, "");
    expect(visible).not.toContain("^");
    expect(visible).not.toContain("{");
    expect(visible).not.toContain("}");
  });
});

describe("house style for powers and spacing", () => {
  const tex = (html: string) =>
    [...html.matchAll(/<annotation encoding="application\/x-tex">([^<]*)<\/annotation>/g)].map((m) => m[1]);

  it("keeps multi-digit, decimal and signed exponents whole", () => {
    expect(tex(renderMixedMath("Find $M^13$ and $y^2.5$ and $2^-3$ and $x^+12$"))).toEqual([
      "M^{13}", "y^{2.5}", "2^{-3}", "x^{+12}",
    ]);
  });

  it("braces long subscripts inside maths only", () => {
    expect(tex(renderMixedMath("Solve $a_12 = 3$"))).toEqual(["a_{12} = 3"]);
  });

  it("puts a space between words and inline maths but keeps units and ordinals glued", () => {
    const text = renderMixedMath("Given that$f(x)$and$g(x)$find it. The $n$th term");
    expect(text.replace(/<span class="katex">[\s\S]*?<\/span><\/span><\/span>/g, "<M>").replace(/<[^>]+>/g, "")).toBe(
      "Given that  and  find it. The th term",
    );
  });

  it("does not squeeze the space in a ratio", () => {
    expect(renderMixedMath("Ratio 3 : 4")).toContain("3 : 4");
  });
});

import { describe, expect, it } from "vitest";
import { DIAGRAMS, START_ID, catalogProblems, childrenOf, diagramById, breadcrumbOf, filterDiagrams } from "./catalog";

describe("architecture catalog", () => {
  it("has no broken links, duplicate ids or unknown diagram types", () => {
    expect(catalogProblems()).toEqual([]);
  });

  it("covers DFD levels 0 to 3 and every repo", () => {
    const levels = new Set(DIAGRAMS.filter((d) => d.family === "dfd").map((d) => d.level));
    expect([...levels].sort()).toEqual([0, 1, 2, 3]);
    for (const repo of ["system", "backend", "teacher", "admin"]) {
      expect(DIAGRAMS.some((d) => d.repo === repo)).toBe(true);
    }
  });

  it("opens on the level 0 diagram and can drill down to level 3", () => {
    const start = diagramById(START_ID);
    expect(start?.level).toBe(0);
    const level1 = childrenOf(start!);
    expect(level1.length).toBeGreaterThan(0);
    const level2 = level1.flatMap(childrenOf);
    const level3 = level2.flatMap(childrenOf);
    expect(level3.length).toBeGreaterThan(0);
    expect(breadcrumbOf(level3[0].id)[0].id).toBe(START_ID);
  });

  it("filters by repo, family and text", () => {
    expect(filterDiagrams({ repo: "teacher", family: "all", query: "" }).every((d) => d.repo === "teacher")).toBe(true);
    expect(filterDiagrams({ repo: "all", family: "er", query: "" }).every((d) => d.family === "er")).toBe(true);
    expect(filterDiagrams({ repo: "all", family: "all", query: "razorpay" }).length).toBeGreaterThan(0);
  });

  it("keeps every Mermaid source free of characters that break the embedding", () => {
    for (const d of DIAGRAMS) {
      expect(d.source.includes("`"), d.id).toBe(false);
      expect(d.source.trim().length, d.id).toBeGreaterThan(20);
    }
  });
});

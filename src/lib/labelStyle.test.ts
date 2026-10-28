import { describe, expect, it } from "vitest";
import { labelCase } from "./labelStyle";

describe("labelCase", () => {
  it.each([
    ["area of a triangle", "Area of a Triangle"],
    ["Area Of A Triangle", "Area of a Triangle"],
    ["similarity and congruence", "Similarity and Congruence"],
    ["box-and-whisker plots", "Box-and-Whisker Plots"],
    ["popular_igcse", "Popular IGCSE"],
    ["Igcse maths", "IGCSE Maths"],
    ["prime factorization/hcf/lcm", "Prime Factorization/HCF/LCM"],
    ["3d trigonometry", "3D Trigonometry"],
    ["percentages (increase decrease)", "Percentages (Increase Decrease)"],
    ["probability - tree diagrams - two bags of balls", "Probability - Tree Diagrams - Two Bags of Balls"],
    ["", ""],
  ])("%s -> %s", (raw, expected) => {
    expect(labelCase(raw)).toBe(expected);
  });

  it("leaves taxonomy labels unchanged", () => {
    for (const label of ["Prime Factorization/HCF/LCM", "Right-Angled Triangle Trigonometry", "Distance-Time and Speed-Time Graphs", "Indices (Algebraic)"]) {
      expect(labelCase(label)).toBe(label);
    }
  });
});

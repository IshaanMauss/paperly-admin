import { describe, expect, it } from "vitest";
import {
  combinationKey,
  combinationLabel,
  humanizeTemplateText,
  subtopicLabel,
  teacherExampleText,
  teacherPatternText,
  teacherSelectionSummary,
  templatePartSubtopics,
  titleCase,
} from "./templatePresentation";
import type { TemplateSummary } from "./apiClient";

describe("titleCase", () => {
  it("capitalizes the first letter of every word", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });

  it("leaves already-capitalized text unchanged", () => {
    expect(titleCase("Hello World")).toBe("Hello World");
  });
});

describe("subtopicLabel", () => {
  it("returns the real taxonomy label for a valid topic/subtopic pair", () => {
    expect(subtopicLabel("number", "types of number")).toBe("Types of Number");
  });

  it("falls back to a title-cased version of the raw value when it isn't in the taxonomy", () => {
    expect(subtopicLabel("number", "some made up thing")).toBe("Some Made Up Thing");
  });

  it("returns General when no value is given", () => {
    expect(subtopicLabel("number", null)).toBe("General");
    expect(subtopicLabel("number", undefined)).toBe("General");
  });
});

describe("templatePartSubtopics", () => {
  it("prefers per-part subtopics over the top-level one when parts exist", () => {
    const template = {
      subtopic: "top-level-subtopic",
      parts: [{ subtopic: "part-a-subtopic" }, { subtopic: "part-b-subtopic" }],
    } as unknown as TemplateSummary;
    expect(templatePartSubtopics(template)).toEqual(["part-a-subtopic", "part-b-subtopic"]);
  });

  it("falls back to the top-level subtopic when there are no parts", () => {
    const template = { subtopic: "top-level-subtopic", parts: [] } as unknown as TemplateSummary;
    expect(templatePartSubtopics(template)).toEqual(["top-level-subtopic"]);
  });

  it("filters out parts with a missing/non-string subtopic", () => {
    const template = {
      subtopic: "fallback",
      parts: [{ subtopic: "real" }, { subtopic: null }, {}],
    } as unknown as TemplateSummary;
    expect(templatePartSubtopics(template)).toEqual(["real"]);
  });
});

describe("combinationKey / combinationLabel", () => {
  it("joins values with the || separator for a stable dedup key", () => {
    expect(combinationKey(["a", "b", "c"])).toBe("a||b||c");
  });

  it("joins human labels with + for display", () => {
    expect(combinationLabel("number", ["types of number"])).toBe("Types of Number");
  });
});

describe("humanizeTemplateText", () => {
  it("converts ${var} and {var} placeholders into <var> form", () => {
    expect(humanizeTemplateText("value is ${x} and {y}")).toBe("value is <x> and <y>");
  });

  it("collapses newlines and repeated whitespace", () => {
    expect(humanizeTemplateText("line one\nline   two")).toBe("line one line two");
  });

  it("handles null/undefined input without throwing", () => {
    expect(humanizeTemplateText(null)).toBe("");
    expect(humanizeTemplateText(undefined)).toBe("");
  });
});

describe("teacherExampleText / teacherPatternText", () => {
  it("prefers question_text over question_template for the example text", () => {
    const item = { question_text: "rendered text", question_template: "{template} text" } as unknown as TemplateSummary;
    expect(teacherExampleText(item)).toBe("rendered text");
  });

  it("falls back to question_template when question_text is missing", () => {
    const item = { question_template: "template  text" } as unknown as TemplateSummary;
    expect(teacherExampleText(item)).toBe("template text");
  });

  it("humanizes placeholders for the pattern text", () => {
    const item = { question_template: "find {x}" } as unknown as TemplateSummary;
    expect(teacherPatternText(item)).toBe("find <x>");
  });
});

describe("teacherSelectionSummary", () => {
  it("labels a single-part template correctly", () => {
    const item = { template_type: "single", subtopic: "types of number", difficulty: "easy" } as unknown as TemplateSummary;
    const summary = teacherSelectionSummary("number", item);
    expect(summary.form).toBe("Single");
    expect(summary.skill).toBe("Types of Number");
    expect(summary.level).toBe("Easy");
  });

  it("labels a multi-part (chained) template with its part count", () => {
    const item = {
      template_type: "multi_part",
      parts: [{ subtopic: "types of number" }, { subtopic: "types of number" }],
      difficulty: "hard",
    } as unknown as TemplateSummary;
    const summary = teacherSelectionSummary("number", item);
    expect(summary.form).toBe("Chained (2 parts)");
    expect(summary.level).toBe("Hard");
  });

  it("defaults difficulty to medium when missing", () => {
    const item = { template_type: "single", subtopic: "types of number" } as unknown as TemplateSummary;
    expect(teacherSelectionSummary("number", item).level).toBe("Medium");
  });
});

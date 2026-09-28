import { describe, expect, it } from "vitest";
import { ensureSubtopic, subtopicsFor } from "./taxonomy";

describe("subtopicsFor", () => {
  it("returns the real subtopic list for a known topic", () => {
    const options = subtopicsFor("number");
    expect(options.length).toBeGreaterThan(0);
    expect(options.some((o) => o.value === "types of number")).toBe(true);
  });

  it("returns an empty array for an unknown topic", () => {
    expect(subtopicsFor("not-a-real-topic")).toEqual([]);
  });
});

describe("ensureSubtopic", () => {
  it("keeps a subtopic that is genuinely valid for the given topic", () => {
    expect(ensureSubtopic("number", "types of number")).toBe("types of number");
  });

  it("falls back to the topic's first valid subtopic when given an invalid one", () => {
    const [first] = subtopicsFor("number");
    expect(ensureSubtopic("number", "not-a-real-subtopic")).toBe(first.value);
  });

  it("returns an empty string when the topic itself has no subtopics", () => {
    expect(ensureSubtopic("not-a-real-topic", "anything")).toBe("");
  });
});

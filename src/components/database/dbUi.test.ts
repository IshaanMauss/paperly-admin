import { describe, expect, it } from "vitest";

import { formatBytes, formatNumber } from "./dbUi";

describe("database display helpers", () => {
  it("formats sizes in plain units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(300 * 1024 * 1024)).toBe("300 MB");
  });

  it("formats counts and tolerates missing values", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(null)).toBe("-");
    expect(formatNumber(undefined)).toBe("-");
  });
});

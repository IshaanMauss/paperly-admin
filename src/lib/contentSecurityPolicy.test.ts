import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy, cspHeaderFor, cspModeFrom } from "./contentSecurityPolicy";

describe("admin content security policy", () => {
  const prod = buildContentSecurityPolicy({ isDev: false });

  it("only talks to its own server and the font host", () => {
    expect(prod).toContain("connect-src 'self'");
    expect(prod).not.toMatch(/connect-src[^;]*https:/);
    expect(prod).toContain("https://fonts.gstatic.com");
    expect(prod).toContain("frame-src 'none'");
  });

  it("cannot be framed or used to load plug-ins", () => {
    expect(prod).toContain("frame-ancestors 'none'");
    expect(prod).toContain("object-src 'none'");
    expect(prod).toContain("upgrade-insecure-requests");
  });

  it("allows eval only in development", () => {
    expect(prod).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ isDev: true })).toContain("'unsafe-eval'");
  });

  it("defaults to report-only", () => {
    expect(cspModeFrom(undefined)).toBe("report-only");
    expect(cspHeaderFor(cspModeFrom("enforce"), "x")?.key).toBe("Content-Security-Policy");
    expect(cspHeaderFor("off", "x")).toBeNull();
  });
});

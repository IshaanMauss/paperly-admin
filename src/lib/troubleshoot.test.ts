import { describe, expect, it } from "vitest";
import { diagnose } from "./troubleshoot";

describe("diagnose", () => {
  it("flags a 401 on an auth path as medium urgency with the auth-specific explanation", () => {
    const result = diagnose({ status_code: 401, path: "/api/admin/auth/login" });
    expect(result.title).toBe("Unauthorized (401)");
    expect(result.urgency).toBe("medium");
    expect(result.likelyCause).toMatch(/sign-in or session-refresh/i);
  });

  it("gives a non-auth 401 the generic explanation, not the auth-specific one", () => {
    const result = diagnose({ status_code: 401, path: "/api/templates" });
    expect(result.likelyCause).not.toMatch(/sign-in or session-refresh/i);
  });

  it("treats 404 as low urgency", () => {
    expect(diagnose({ status_code: 404 }).urgency).toBe("low");
  });

  it("treats a 500 with a timeout-mentioning detail as a timeout diagnosis", () => {
    const result = diagnose({ status_code: 500, error_detail: "upstream request timed out" });
    expect(result.title).toContain("timeout");
    expect(result.urgency).toBe("high");
  });

  it("treats a 500 mentioning sqlalchemy as a database diagnosis", () => {
    const result = diagnose({ status_code: 503, error_detail: "sqlalchemy.exc.OperationalError" });
    expect(result.title).toContain("database");
  });

  it("gives a generic 500 the payment-specific cause when the path is a billing path", () => {
    const result = diagnose({ status_code: 500, path: "/api/billing/checkout", error_detail: "boom" });
    expect(result.likelyCause).toMatch(/billing\/payment path/i);
  });

  it("falls back to an unknown-status diagnosis when no status code is given", () => {
    const result = diagnose({});
    expect(result.title).toBe("Status unknown");
    expect(result.urgency).toBe("low");
  });

  it("treats any 2xx/300-399 status as the final low-urgency fallback, not a client/server error branch", () => {
    const result = diagnose({ status_code: 302 });
    expect(result.urgency).toBe("low");
    expect(result.title).toBe("Status 302");
  });
});

import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./adminAuth";

describe("authErrorMessage", () => {
  it("extracts a FastAPI-style {detail} string", () => {
    expect(authErrorMessage('{"detail":"Invalid credentials"}', "fallback")).toBe("Invalid credentials");
  });

  it("extracts a {message} string when detail is absent", () => {
    expect(authErrorMessage('{"message":"Session expired"}', "fallback")).toBe("Session expired");
  });

  it("returns the fallback for an empty body", () => {
    expect(authErrorMessage("", "Request failed")).toBe("Request failed");
  });

  it("returns the fallback rather than showing raw HTML (e.g. a proxy error page)", () => {
    expect(authErrorMessage("<html><body>502 Bad Gateway</body></html>", "fallback")).toBe("fallback");
  });

  it("returns short, non-JSON, non-HTML plain text directly (e.g. a raw traceback line)", () => {
    expect(authErrorMessage("AssertionError: bad state", "fallback")).toBe("AssertionError: bad state");
  });

  it("returns the fallback for overly long non-JSON text rather than dumping it raw", () => {
    const long = "x".repeat(400);
    expect(authErrorMessage(long, "fallback")).toBe("fallback");
  });
});

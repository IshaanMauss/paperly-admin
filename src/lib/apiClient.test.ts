import { describe, expect, it } from "vitest";
import { adminApiErrorMessage, adminQuery } from "./apiClient";

describe("adminQuery", () => {
  it("builds a query string from provided params", () => {
    expect(adminQuery({ page: 2, sort: "recent" } as never)).toBe("?page=2&sort=recent");
  });

  it("omits undefined, null, empty-string, and the sentinel 'all' value", () => {
    expect(
      adminQuery({ status: "all", search: "", severity: undefined, method: null, page: 1 } as never)
    ).toBe("?page=1");
  });

  it("returns an empty string (not '?') when every param is filtered out", () => {
    expect(adminQuery({ status: "all" } as never)).toBe("");
  });

  it("returns an empty string when called with no params at all", () => {
    expect(adminQuery()).toBe("");
  });
});

describe("adminApiErrorMessage", () => {
  it("extracts a FastAPI-style {detail} string", () => {
    expect(adminApiErrorMessage('{"detail":"Template not found"}', "fallback")).toBe("Template not found");
  });

  it("joins a FastAPI-style 422 validation array into a readable field: message list", () => {
    const body = JSON.stringify({
      detail: [
        { loc: ["body", "topic"], msg: "field required" },
        { loc: ["body", "count"], msg: "must be positive" },
      ],
    });
    expect(adminApiErrorMessage(body, "fallback")).toBe("body.topic: field required; body.count: must be positive");
  });

  it("returns the fallback for an HTML proxy error page", () => {
    expect(adminApiErrorMessage("<!DOCTYPE html><html></html>", "fallback")).toBe("fallback");
  });

  it("returns the fallback for an empty body", () => {
    expect(adminApiErrorMessage("", "Request failed with status 500")).toBe("Request failed with status 500");
  });

  it("returns short raw text as-is when it isn't JSON or markup", () => {
    expect(adminApiErrorMessage("KeyError: 'template_id'", "fallback")).toBe("KeyError: 'template_id'");
  });
});

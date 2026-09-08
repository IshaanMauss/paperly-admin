// Rule-based troubleshoot knowledge base for server log entries. No ML, no
// backend call - a fast lookup so an admin under time pressure gets an
// immediate diagnosis + suggested fix from the status code, method, path
// pattern, and error text alone, instead of having to reason it out cold.

export type Diagnosis = {
  title: string;
  likelyCause: string;
  suggestedFix: string;
  urgency: "low" | "medium" | "high";
};

function pathHints(path: string | null | undefined) {
  const p = (path || "").toLowerCase();
  return {
    isAuth: p.includes("/auth") || p.includes("/login") || p.includes("/session"),
    isPayment: p.includes("/billing") || p.includes("/payment") || p.includes("/razorpay") || p.includes("/subscription"),
    isWorksheet: p.includes("/worksheet"),
    isAdmin: p.includes("/admin"),
    isTemplate: p.includes("/template"),
  };
}

export function diagnose(row: {
  status_code?: number | null;
  method?: string | null;
  path?: string | null;
  error_detail?: string | null;
  duration_ms?: number | null;
}): Diagnosis {
  const code = row.status_code ?? 0;
  const hints = pathHints(row.path);
  const detail = (row.error_detail || "").toLowerCase();

  if (code === 401) {
    return {
      title: "Unauthorized (401)",
      likelyCause: hints.isAuth
        ? "A sign-in or session-refresh attempt failed - expired token, wrong credentials, or a session that expired mid-use."
        : "The caller's session/token was missing, expired, or invalid for this route.",
      suggestedFix: "Check whether this is one user (ask them to sign out/in again) or many users at once (a token/secret rotation or clock-skew issue on the backend needs checking).",
      urgency: "medium",
    };
  }
  if (code === 403) {
    return {
      title: "Forbidden (403)",
      likelyCause: hints.isAdmin
        ? "An admin session tried an action outside its RBAC role's permissions."
        : "The signed-in user doesn't have permission for this action (wrong plan tier, wrong role, or accessing another user's resource).",
      suggestedFix: "Confirm the actor's role/plan matches what the route requires. If this actor should have access, check the permission mapping; if not, this may be a probing/abuse attempt worth watching.",
      urgency: "medium",
    };
  }
  if (code === 404) {
    return {
      title: "Not Found (404)",
      likelyCause: "The requested resource (template, worksheet, route) doesn't exist - could be a stale link, a deleted/renamed resource, or a frontend/backend route mismatch after a deploy.",
      suggestedFix: "If this is one path repeating across many users, check for a frontend build referencing an old/renamed backend route. If it's one-off, likely a stale link or deleted record - usually safe to ignore.",
      urgency: "low",
    };
  }
  if (code === 409) {
    return {
      title: "Conflict (409)",
      likelyCause: "A duplicate action or idempotency-key collision - e.g. a double-click generation request, or two requests racing for the same resource.",
      suggestedFix: "Expected occasionally under normal use (idempotency protection working as intended). Investigate only if it's frequent for one actor, which could mean a broken retry loop on the frontend.",
      urgency: "low",
    };
  }
  if (code === 422) {
    return {
      title: "Validation error (422)",
      likelyCause: hints.isTemplate
        ? "A template/worksheet payload failed schema validation - likely a malformed constraint, missing required field, or wrong JSON shape."
        : "The request body didn't match what the backend expected.",
      suggestedFix: "Open the error detail below for the exact field/reason. If this is template JSON, check it against the real schema (constraints need {expr, reason}, not invented fields).",
      urgency: "low",
    };
  }
  if (code === 429) {
    return {
      title: "Rate limited (429)",
      likelyCause: "The actor exceeded a rate limit (login attempts, generation requests, OTP resends, etc).",
      suggestedFix: "Normal if it's protecting against abuse. If a legitimate user is being blocked repeatedly, the limit may need loosening for that route.",
      urgency: "medium",
    };
  }
  if (code >= 500) {
    if (detail.includes("timeout") || detail.includes("timed out")) {
      return {
        title: `Server error (${code}) - timeout`,
        likelyCause: "A downstream call (database, LLM API, PDF export) took too long and the request timed out.",
        suggestedFix: "Check whether this correlates with a specific slow operation (worksheet generation, PDF export). If frequent, the timeout budget or the slow dependency itself needs attention.",
        urgency: "high",
      };
    }
    if (detail.includes("database") || detail.includes("connection") || detail.includes("psycopg") || detail.includes("sqlalchemy")) {
      return {
        title: `Server error (${code}) - database`,
        likelyCause: "A database connection or query failure - connection pool exhaustion, a bad migration state, or the database being briefly unreachable.",
        suggestedFix: "If this is a single spike, likely transient. If sustained, check the database's own status/connection limits before anything else.",
        urgency: "high",
      };
    }
    return {
      title: `Server error (${code})`,
      likelyCause: hints.isPayment
        ? "An unhandled exception in the billing/payment path - check the error detail for the exact failure."
        : hints.isWorksheet
        ? "An unhandled exception during worksheet/template generation or export - check the error detail for the exact failure."
        : "An unhandled backend exception - check the error detail below for the exact exception message.",
      suggestedFix: "Open the error detail below first. If it names a specific function/file, that's the fastest path to the fix. If this is new since the last deploy, consider rolling back that change.",
      urgency: "high",
    };
  }
  if (code >= 400) {
    return {
      title: `Client error (${code})`,
      likelyCause: "The request itself was malformed or invalid in some way not covered by the more specific codes above.",
      suggestedFix: "Check the error detail below for specifics.",
      urgency: "low",
    };
  }
  return {
    title: `Status ${code || "unknown"}`,
    likelyCause: "No specific diagnosis rule for this status code yet.",
    suggestedFix: "Check the error detail and path below manually.",
    urgency: "low",
  };
}

/**
 * Pure helpers for the admin gateway proxy (src/pages/api/gateway/[...path].ts).
 * Kept separate so they can be tested without a running server.
 */

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "accept-encoding",
]);

// Request headers that must never be forwarded from the browser to the backend. The gateway
// secret is added by the proxy itself; anything the browser sends under that name is dropped so it
// cannot be used to probe or spoof it. Cloudflare's own headers are not needed by the backend.
const NEVER_FORWARD_PREFIXES = ["x-ztna-", "cf-", "x-forwarded-", "x-vercel-", "x-real-ip"];

export function buildTargetUrl(backendBase: string, segments: string[] | string | undefined, search: string): string | null {
  const list = Array.isArray(segments) ? segments : segments ? [segments] : [];
  if (!list.length) return null;
  for (const segment of list) {
    if (!segment || segment === "." || segment === ".." || /[\\/]/.test(segment) || segment.includes("\0")) return null;
  }
  const base = backendBase.replace(/\/+$/, "");
  const path = list.map((segment) => encodeURIComponent(segment)).join("/");
  return `${base}/${path}${search || ""}`;
}

export function forwardRequestHeaders(incoming: Record<string, string | string[] | undefined>, gatewayHeader: string, gatewaySecret: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(incoming)) {
    const key = name.toLowerCase();
    if (value === undefined || HOP_BY_HOP.has(key) || NEVER_FORWARD_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    out[key] = Array.isArray(value) ? value.join(", ") : value;
  }
  if (gatewaySecret) out[gatewayHeader.toLowerCase()] = gatewaySecret;
  return out;
}

/** Make a backend cookie belong to the admin site itself (host-only, whole site). */
export function rewriteSetCookie(cookie: string): string {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .filter((part) => !/^domain=/i.test(part))
    .map((part) => (/^path=/i.test(part) ? "Path=/" : part))
    .join("; ");
}

/**
 * When the admin site itself is served over plain http (local use on http://localhost), browsers
 * can refuse the backend's production cookie (it is Secure, SameSite=None and named __Host-...),
 * which silently logs the admin out on every page refresh. Make it an ordinary same-site cookie
 * instead. The backend accepts both cookie names, so nothing else changes. Over https the cookie
 * is left exactly as the backend sent it.
 */
export function adaptSetCookieForPlainHttp(cookie: string): string {
  const parts = cookie
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^secure$/i.test(part))
    .map((part) => (/^samesite=none$/i.test(part) ? "SameSite=Lax" : part));
  if (!parts.length) return cookie;
  parts[0] = parts[0].replace(/^__(?:Host|Secure)-/, "");
  return parts.join("; ");
}

export function skipResponseHeader(name: string): boolean {
  const key = name.toLowerCase();
  return HOP_BY_HOP.has(key) || key === "content-encoding" || key === "set-cookie" || key.startsWith("access-control-");
}

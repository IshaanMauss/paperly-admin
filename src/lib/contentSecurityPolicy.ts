/**
 * Content-Security-Policy for the admin panel. This app talks only to its own server (the gateway proxy adds the
 * backend secret server-side), so almost everything is closed. The one outside host is the web font.
 *
 * CSP_MODE (server environment): "report-only" (default) lists what would be blocked without blocking it,
 * "enforce" blocks, "off" sends nothing.
 */

export type CspMode = "enforce" | "report-only" | "off";

export function cspModeFrom(value: string | undefined): CspMode {
  const clean = (value || "").trim().toLowerCase();
  if (clean === "enforce" || clean === "off") return clean;
  return "report-only";
}

export function buildContentSecurityPolicy(options: { isDev: boolean; reportUri?: string }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${options.isDev ? " ws://localhost:* http://localhost:* http://127.0.0.1:*" : ""}`,
    "frame-src 'none'",
    "media-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!options.isDev) directives.push("upgrade-insecure-requests");
  if (options.reportUri) directives.push(`report-uri ${options.reportUri}`);
  return directives.join("; ");
}

export function cspHeaderFor(mode: CspMode, policy: string): { key: string; value: string } | null {
  if (mode === "off") return null;
  return { key: mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", value: policy };
}

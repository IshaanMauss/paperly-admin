import type { NextApiRequest, NextApiResponse } from "next";
import { verifyCfAccessJwt } from "@/lib/server/cfAccess";
import { adaptSetCookieForPlainHttp, buildTargetUrl, forwardRequestHeaders, rewriteSetCookie, skipResponseHeader } from "@/lib/server/gatewayProxy";

/**
 * Admin gateway proxy (the permanent fix for the admin panel being blocked by ZTNA_GATEWAY_SECRET).
 *
 * The browser only ever talks to THIS site (same origin, /api/gateway/...). This server-side route
 * forwards the call to the backend and adds the gateway secret header there. The secret lives in a
 * server-only environment variable, so it never reaches browser code.
 *
 * Server environment variables (none start with NEXT_PUBLIC_):
 *   ADMIN_BACKEND_URL      e.g. https://<your-railway-host>/api   (required)
 *   ADMIN_GATEWAY_SECRET   same value as ZTNA_GATEWAY_SECRET on the backend
 *   ADMIN_GATEWAY_HEADER   optional, defaults to X-Ztna-Gateway-Secret (matches the backend)
 *   CF_ACCESS_TEAM_DOMAIN  e.g. yourteam.cloudflareaccess.com   } set both to require a valid
 *   CF_ACCESS_AUD          the Access application's AUD tag       } Cloudflare Access login
 *
 * With the two CF_ACCESS_* values set, a request that did not come through Cloudflare Access is
 * refused here, so finding the raw hosting URL of this site gives no way around the login wall.
 */

export const config = {
  api: { bodyParser: false, responseLimit: false },
  maxDuration: 60,
};

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);

async function readBody(req: NextApiRequest): Promise<Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const backend = process.env.ADMIN_BACKEND_URL || "";
  if (!backend) {
    res.status(503).json({ detail: "The admin gateway is not configured (ADMIN_BACKEND_URL is missing)." });
    return;
  }
  if (!req.method || !ALLOWED_METHODS.has(req.method)) {
    res.status(405).json({ detail: "Method not allowed." });
    return;
  }

  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN || "";
  const audience = process.env.CF_ACCESS_AUD || "";
  if (teamDomain && audience) {
    const header = req.headers["cf-access-jwt-assertion"];
    const email = await verifyCfAccessJwt(Array.isArray(header) ? header[0] : header, { teamDomain, audience });
    if (!email) {
      res.status(403).json({ detail: "Sign in through the company access login to use the admin panel." });
      return;
    }
  }

  const search = req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const target = buildTargetUrl(backend, req.query.path, search);
  if (!target) {
    res.status(400).json({ detail: "Bad admin API path." });
    return;
  }

  const headers = forwardRequestHeaders(req.headers, process.env.ADMIN_GATEWAY_HEADER || "X-Ztna-Gateway-Secret", process.env.ADMIN_GATEWAY_SECRET || "");
  const body = await readBody(req);

  let upstream: Response;
  try {
    upstream = await fetch(target, { method: req.method, headers, body: body as unknown as BodyInit | undefined, redirect: "manual", signal: AbortSignal.timeout(55_000) });
  } catch {
    res.status(502).json({ detail: "The admin backend is not reachable right now." });
    return;
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, name) => {
    if (!skipResponseHeader(name)) res.setHeader(name, value);
  });
  const cookies = typeof upstream.headers.getSetCookie === "function" ? upstream.headers.getSetCookie() : [];
  if (cookies.length) {
    const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
    const secureOrigin = forwardedProto ? forwardedProto === "https" : Boolean((req.socket as { encrypted?: boolean }).encrypted);
    res.setHeader("Set-Cookie", cookies.map((cookie) => rewriteSetCookie(secureOrigin ? cookie : adaptSetCookieForPlainHttp(cookie))));
  }
  res.setHeader("Cache-Control", "no-store");
  res.send(Buffer.from(await upstream.arrayBuffer()));
}

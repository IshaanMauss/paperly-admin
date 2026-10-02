import { createPublicKey, verify as cryptoVerify } from "node:crypto";

/**
 * Verifies the Cloudflare Access login token (the Cf-Access-Jwt-Assertion header) on the server.
 * Cloudflare Access signs it with RS256 after the person passes the Access login. Checking it
 * here means the admin gateway proxy refuses any request that did not come through Access, even
 * if someone finds the raw hosting URL of this site.
 *
 * No dependency: Node's crypto verifies the signature against the team's public keys (JWKS).
 */

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string };
type Jwks = { keys: Jwk[] };

const JWKS_TTL_MS = 10 * 60 * 1000;
let cache: { url: string; fetchedAt: number; jwks: Jwks } | null = null;

function b64urlToBuffer(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function loadJwks(teamDomain: string, fetchImpl: typeof fetch): Promise<Jwks> {
  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  if (cache && cache.url === url && Date.now() - cache.fetchedAt < JWKS_TTL_MS) return cache.jwks;
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error("Could not load Cloudflare Access keys");
  const jwks = (await response.json()) as Jwks;
  cache = { url, fetchedAt: Date.now(), jwks };
  return jwks;
}

export function resetCfAccessKeyCache() {
  cache = null;
}

export type CfAccessConfig = { teamDomain: string; audience: string };

/** Returns the email in the token when it is valid, otherwise null. Never throws. */
export async function verifyCfAccessJwt(
  token: string | undefined,
  config: CfAccessConfig,
  fetchImpl: typeof fetch = fetch,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const header = JSON.parse(b64urlToBuffer(parts[0]).toString("utf8")) as { kid?: string; alg?: string };
    if (header.alg !== "RS256" || !header.kid) return null;
    const claims = JSON.parse(b64urlToBuffer(parts[1]).toString("utf8")) as {
      aud?: string | string[];
      iss?: string;
      exp?: number;
      nbf?: number;
      email?: string;
    };
    if (claims.iss !== `https://${config.teamDomain}`) return null;
    const audiences = Array.isArray(claims.aud) ? claims.aud : claims.aud ? [claims.aud] : [];
    if (!audiences.includes(config.audience)) return null;
    if (typeof claims.exp !== "number" || claims.exp <= nowSeconds) return null;
    if (typeof claims.nbf === "number" && claims.nbf > nowSeconds + 60) return null;

    const jwks = await loadJwks(config.teamDomain, fetchImpl);
    const jwk = jwks.keys.find((key) => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;
    const publicKey = createPublicKey({ key: jwk as unknown as import("node:crypto").JsonWebKey, format: "jwk" });
    const valid = cryptoVerify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, b64urlToBuffer(parts[2]));
    return valid ? String(claims.email || "access-user") : null;
  } catch {
    return null;
  }
}

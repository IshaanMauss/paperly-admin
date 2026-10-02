const ADMIN_ACCESS_TOKEN_KEY = "paperly_admin_access_token";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8003/api";

let adminAccessToken = "";
let adminRefreshInFlight: Promise<{ access_token?: string; admin?: unknown } | null> | null = null;

function storageAvailable() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
  return atob(padded);
}

export function setAdminAccessToken(token: string) {
  adminAccessToken = token;
  if (storageAvailable()) {
    window.sessionStorage.setItem(ADMIN_ACCESS_TOKEN_KEY, token);
  }
}

export function getAdminAccessToken() {
  if (!adminAccessToken && storageAvailable()) {
    adminAccessToken = window.sessionStorage.getItem(ADMIN_ACCESS_TOKEN_KEY) || "";
  }
  return adminAccessToken;
}

export function isAdminAccessTokenExpiring(bufferSeconds = 60) {
  const token = getAdminAccessToken();
  if (!token || typeof window === "undefined") return true;
  try {
    const [, payload] = token.split(".");
    if (!payload) return true;
    const parsed = JSON.parse(decodeBase64Url(payload)) as { exp?: number; aud?: string };
    if (parsed.aud && parsed.aud !== "paperly-admin") return true;
    if (!parsed.exp) return true;
    return parsed.exp * 1000 <= Date.now() + bufferSeconds * 1000;
  } catch {
    return true;
  }
}

export function clearAdminAccessToken() {
  adminAccessToken = "";
  if (storageAvailable()) {
    window.sessionStorage.removeItem(ADMIN_ACCESS_TOKEN_KEY);
  }
}

export async function refreshAdminAccessToken() {
  if (adminRefreshInFlight) return adminRefreshInFlight;
  adminRefreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/admin/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        clearAdminAccessToken();
        return null;
      }
      const payload = (await response.json()) as { access_token?: string; admin?: unknown };
      if (!payload.access_token) {
        clearAdminAccessToken();
        return null;
      }
      setAdminAccessToken(payload.access_token);
      return payload;
    } catch {
      clearAdminAccessToken();
      return null;
    } finally {
      adminRefreshInFlight = null;
    }
  })();
  return adminRefreshInFlight;
}

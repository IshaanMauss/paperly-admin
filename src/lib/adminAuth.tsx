import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clearAdminAccessToken, getAdminAccessToken, isAdminAccessTokenExpiring, refreshAdminAccessToken, setAdminAccessToken } from "@/lib/adminToken";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8003/api";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  active: boolean;
  last_login_at?: string | null;
};

type AuthState = {
  ready: boolean;
  admin: AdminUser | null;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  refresh(): Promise<boolean>;
  hasPermission(permission: string): boolean;
};

const AdminAuthContext = createContext<AuthState | null>(null);

// Same rule as apiClient.ts's adminApiErrorMessage(): a non-OK auth response
// body can be a raw traceback or an HTML error page (e.g. a proxy's 502/504
// interstitial) rather than JSON - login is exactly the page where staff are
// most likely to hit a backend that's briefly unreachable, so this matters
// here even more than on the rest of the panel.
export function authErrorMessage(text: string, fallback: string): string {
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text) as { detail?: unknown; message?: unknown };
    const detail = parsed.detail ?? parsed.message;
    if (typeof detail === "string") return detail;
  } catch {
    const looksLikeMarkup = /<\s*(!doctype|html|head|body|script)\b/i.test(text);
    if (!looksLikeMarkup && text.length <= 300) return text;
  }
  return fallback;
}

async function authRequest(path: string, options?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(authErrorMessage(text, `Request failed with status ${response.status}`));
  }
  return response.json() as Promise<{ access_token?: string; admin?: AdminUser }>;
}

async function authedAdminRequest(path: string) {
  const token = getAdminAccessToken();
  if (!token) throw new Error("Admin access token missing.");
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(authErrorMessage(text, `Request failed with status ${response.status}`));
  }
  return response.json() as Promise<{ admin?: AdminUser }>;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const applyAuth = useCallback((payload: { access_token?: string; admin?: AdminUser }) => {
    if (!payload.access_token || !payload.admin) throw new Error("Admin auth response was incomplete.");
    setAdminAccessToken(payload.access_token);
    setAdmin(payload.admin);
  }, []);

  // One shared refresh for the whole page (module level in adminToken.ts), so a reload,
  // hot reload or several components asking at once never spend the same one-time
  // refresh cookie twice.
  const refresh = useCallback(async () => {
    try {
      const payload = await refreshAdminAccessToken();
      if (!payload?.access_token || !payload.admin) throw new Error("Admin refresh response was incomplete.");
      applyAuth(payload as { access_token?: string; admin?: AdminUser });
      return true;
    } catch {
      clearAdminAccessToken();
      setAdmin(null);
      return false;
    } finally {
      setReady(true);
    }
  }, [applyAuth]);

  // On load, reuse the signed-in token kept for this tab (valid 15 minutes) so a page refresh
  // does not depend on the refresh cookie; only ask for a new token when it is missing or old.
  useEffect(() => {
    let active = true;
    const boot = async () => {
      const token = getAdminAccessToken();
      if (token && !isAdminAccessTokenExpiring()) {
        try {
          const payload = await authedAdminRequest("/admin/auth/me");
          if (!active) return;
          if (payload.admin) {
            setAdmin(payload.admin);
            setReady(true);
            return;
          }
        } catch {
          clearAdminAccessToken();
        }
      }
      if (active) void refresh();
    };
    void boot();
    return () => {
      active = false;
    };
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const payload = await authRequest("/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    applyAuth(payload);
    setReady(true);
  }, [applyAuth]);

  const signOut = useCallback(async () => {
    try {
      await authRequest("/admin/auth/logout", { method: "POST" });
    } catch {
      // Local cleanup still wins if the backend is unreachable.
    }
    clearAdminAccessToken();
    setAdmin(null);
    setReady(true);
  }, []);

  const hasPermission = useCallback((permission: string) => {
    if (!admin) return false;
    return admin.permissions.includes("*") || admin.permissions.includes(permission);
  }, [admin]);

  const value = useMemo(() => ({ ready, admin, signIn, signOut, refresh, hasPermission }), [ready, admin, signIn, signOut, refresh, hasPermission]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminSession() {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminSession must be used inside AdminAuthProvider");
  return context;
}

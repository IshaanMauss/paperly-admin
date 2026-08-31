import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clearAdminAccessToken, setAdminAccessToken } from "@/lib/adminToken";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

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
    throw new Error(text || `Request failed with status ${response.status}`);
  }
  return response.json() as Promise<{ access_token?: string; admin?: AdminUser }>;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const applyAuth = useCallback((payload: { access_token?: string; admin?: AdminUser }) => {
    if (!payload.access_token || !payload.admin) throw new Error("Admin auth response was incomplete.");
    setAdminAccessToken(payload.access_token);
    setAdmin(payload.admin);
  }, []);

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const request = (async () => {
      try {
        const payload = await authRequest("/admin/auth/refresh", { method: "POST" });
        applyAuth(payload);
        return true;
      } catch {
        clearAdminAccessToken();
        setAdmin(null);
        return false;
      } finally {
        setReady(true);
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = request;
    return request;
  }, [applyAuth]);

  useEffect(() => {
    void refresh();
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

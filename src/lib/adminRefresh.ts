export const ADMIN_REFRESH_EVENT = "paperly-admin-refresh";

export function requestAdminDataRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_REFRESH_EVENT));
}

export function onAdminDataRefresh(handler: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const listener = () => handler();
  window.addEventListener(ADMIN_REFRESH_EVENT, listener);
  return () => window.removeEventListener(ADMIN_REFRESH_EVENT, listener);
}
import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { input, panel, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type AuditLogItem } from "@/lib/apiClient";

const outcomeStyle: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  failed: "bg-amber-100 text-amber-900",
  error: "bg-rose-100 text-rose-900",
};
const outcomeText: Record<string, string> = { ok: "Worked", failed: "Refused", error: "Error" };

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [days, setDays] = useState(30);
  const [admin, setAdmin] = useState("");
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => onAdminDataRefresh(() => setTick((value) => value + 1)), []);
  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await api.getAuditLog({ days, admin: admin.trim() || undefined, onlyFailed });
        if (!cancelled) setItems(response.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the audit log.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [days, admin, onlyFailed, tick]);

  return (
    <AppShell title="Audit Log">
      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">Everything admins changed</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Every admin action that changes something (suspend, plan changes, offers, maintenance, backups, settings) is recorded here automatically, with who did it, what it touched and whether it worked. Newest first. Passwords and request contents are never stored.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Admin email
            <input className={input} value={admin} onChange={(event) => setAdmin(event.target.value)} placeholder="Any admin" />
          </label>
          <label className="grid gap-1 text-xs font-bold text-slate-600">
            Period
            <select className={input} value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={1}>Last 24 hours</option>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </label>
          <label className="flex items-end gap-2 pb-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={onlyFailed} onChange={(event) => setOnlyFailed(event.target.checked)} />
            Only refused or failed
          </label>
        </div>
        {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!loading && !error && items.length === 0 ? <p className="mt-4 text-sm font-bold text-slate-500">No admin changes in this period.</p> : null}
        {items.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Admin</th>
                  <th className={th}>What they did</th>
                  <th className={th}>Applied to</th>
                  <th className={th}>Result</th>
                  <th className={th}>From</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className={td}>{item.at ? new Date(item.at).toLocaleString() : "-"}</td>
                    <td className={td}>{item.admin}</td>
                    <td className={`${td} font-bold`}>{item.action}</td>
                    <td className={td}>{Object.entries(item.target).map(([key, value]) => `${key.replace(/_/g, " ")}: ${value}`).join(", ") || "-"}</td>
                    <td className={td}>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${outcomeStyle[item.outcome || "ok"]}`}>{outcomeText[item.outcome || "ok"]}</span>
                    </td>
                    <td className={td}>{item.ip || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

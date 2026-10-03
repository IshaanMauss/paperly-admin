import { useCallback, useEffect, useState } from "react";

import { panel, primaryButton } from "@/components/ui";
import { api, type SystemStatus } from "@/lib/apiClient";

const stateStyle: Record<string, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warn: "border-amber-200 bg-amber-50 text-amber-950",
  down: "border-rose-200 bg-rose-50 text-rose-900",
  unknown: "border-slate-200 bg-slate-50 text-slate-700",
};
const stateWord: Record<string, string> = { ok: "OK", warn: "Needs attention", down: "Down", unknown: "Not checkable" };

export function SystemStatusPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api.getSystemStatus());
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Could not read system status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className={panel}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">Live system status</h2>
          <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">
            Checked by the server just now: database, shared rate limits, disk, the last hour of traffic and errors, and the settings that protect money and sign-in. Only yes/no and numbers are shown, never secret values.
          </p>
        </div>
        <button className={primaryButton} onClick={() => void load()} disabled={loading}>{loading ? "Checking..." : "Re-check"}</button>
      </div>
      {error ? <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">Could not read system status: {error}</p> : null}
      {data ? (
        <>
          <p className={`mt-4 inline-flex rounded-full border px-3 py-1 text-sm font-extrabold ${stateStyle[data.overall]}`}>
            Overall: {stateWord[data.overall]} - {data.counts.ok} ok, {data.counts.warn} need attention, {data.counts.down} down, {data.counts.unknown} not checkable
          </p>
          <div className="mt-4 grid gap-5">
            {data.groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-500">{group.title}</h3>
                <div className="mt-2 grid gap-2 xl:grid-cols-2">
                  {group.items.map((item) => (
                    <div key={item.key} className={`rounded-xl border p-3 ${stateStyle[item.state]}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-700">{stateWord[item.state]}</span>
                        <span className="text-sm font-extrabold text-slate-950">{item.label}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{item.detail}</p>
                      {item.action ? <p className="mt-1 text-sm font-extrabold">Do: {item.action}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Checked {new Date(data.checked_at).toLocaleString()} ({data.environment}).</p>
        </>
      ) : null}
    </section>
  );
}

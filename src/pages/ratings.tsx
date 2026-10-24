import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, panel, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api } from "@/lib/apiClient";
import type { RatingsResponse } from "@/lib/ratingTypes";

// Star ratings and comments teachers leave in the in-app pop-up. Newest first; filter by stars.

function when(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}

export default function RatingsPage() {
  const [stars, setStars] = useState<number | null>(null);
  const [data, setData] = useState<RatingsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.getRatings(stars ?? undefined)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load ratings."))
      .finally(() => setLoading(false));
  }, [stars]);
  useEffect(() => { load(); }, [load, tick]);

  return (
    <AppShell title="Ratings">
      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">Ratings and feedback</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Teachers are asked once they have made two papers, and again later if they chose "Remind me later". Anyone who rates is not asked again.
        </p>
        {error ? <p className={`mt-3 ${errorNotice}`}>{error}</p> : null}
        {loading && !data ? <p className="mt-3 text-sm font-bold text-slate-500">Loading...</p> : null}
        {data ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <Stat label="Ratings" value={data.total} />
              <Stat label="Average" value={data.total ? `${data.average} / 5` : "-"} />
              <Stat label="Asked so far" value={Object.values(data.prompt_states).reduce((a, b) => a + b, 0)} />
              <Stat label="Said remind me later" value={data.prompt_states.later ?? 0} />
              <Stat label="Said no thanks" value={(data.prompt_states.declined ?? 0) + (data.prompt_states.stopped ?? 0)} />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-600">
              {[5, 4, 3, 2, 1].map((s) => `${s} star: ${data.by_stars[s] ?? 0}`).join("  |  ")}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} onClick={() => setStars(null)}>All</button>
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" className={secondaryButton} onClick={() => setStars(s)}>{s} star</button>
              ))}
            </div>
            <div className="mt-4 overflow-x-auto">
              <table className={table}>
                <thead>
                  <tr><th className={th}>When</th><th className={th}>Teacher</th><th className={th}>Stars</th><th className={th}>Comment</th><th className={th}>Device</th></tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? <tr><td className={td} colSpan={5}>No ratings yet.</td></tr> : null}
                  {data.items.map((r) => (
                    <tr key={r.id}>
                      <td className={td}>{when(r.created_at)}</td>
                      <td className={td}>{r.name || r.email || r.teacher_id}</td>
                      <td className={td}>{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</td>
                      <td className={td}>{r.comment || "-"}</td>
                      <td className={td}>{r.platform || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}

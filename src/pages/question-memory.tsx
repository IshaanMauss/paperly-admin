import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/router";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api } from "@/lib/apiClient";
import type { MemoryEventRow, MemoryOverview, MemorySupplyRow, MemoryTemplateRow, MemoryUserView } from "@/lib/memoryTypes";

// Question Memory: what each user has already been given, which lists are running low, and what the
// catalogue is missing. Flags describe causes: the first four mean "not enough questions yet", the
// last two ("fault", "forced repeat") mean the code took a fallback and should normally be zero.

type Tab = "summary" | "templates" | "supply" | "flags" | "user";
const TABS: { id: Tab; label: string }[] = [
  { id: "summary", label: "Summary" },
  { id: "templates", label: "Template lists" },
  { id: "supply", label: "Not enough questions" },
  { id: "flags", label: "Flags" },
  { id: "user", label: "One user" },
];

const FLAG_TEXT: Record<string, { label: string; meaning: string; code: boolean }> = {
  near_exhaustion: { label: "Almost used up", meaning: "A user has used 80% or more of a template's answers.", code: false },
  restarted: { label: "List restarted", meaning: "A user used every answer; the list started again with different numbers and wording.", code: false },
  thin_supply: { label: "Thin supply", meaning: "A paper had to reuse a template because there were not enough to choose from.", code: false },
  supply_gap: { label: "Supply gap", meaning: "Someone asked for something the catalogue cannot give (topic, level, marks).", code: false },
  probabilistic_repeat: { label: "Repeat (unmeasured template)", meaning: "A template without a measured answer list repeated an answer.", code: false },
  forced_repeat: { label: "Forced repeat", meaning: "A fallback served a random answer. Should be zero.", code: true },
  fault: { label: "Fault", meaning: "Replay failed or data was missing. Should be zero; each one is a bug to fix.", code: true },
};

function flagBadge(kind: string) {
  const info = FLAG_TEXT[kind];
  const tone = info?.code ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return <span title={info?.meaning} className={`rounded-full border px-2.5 py-1 text-[11px] font-extrabold ${tone}`}>{info?.label ?? kind}</span>;
}

function when(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load()
      .then((result) => !cancelled && setData(result))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Could not load this."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { data, error, loading };
}

function Status({ error, loading }: { error: string; loading: boolean }) {
  return (
    <>
      {error ? <p className={errorNotice}>{error}</p> : null}
      {loading ? <p className="text-sm font-bold text-slate-500">Loading...</p> : null}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p> : null}
    </div>
  );
}

function SummaryTab({ days }: { days: number }) {
  const { data, error, loading } = useLoad<MemoryOverview>(() => api.getMemoryOverview(days), [days]);
  return (
    <section className={panel}>
      <Status error={error} loading={loading} />
      {data ? (
        <>
          <p className={notice}>
            Memory is <b>{data.mode_on ? "ON" : "OFF"}</b> on the server (setting USER_MEMORY_MODE). Paths covered: {data.paths.join(", ") || "none"}.
            {!data.tables_ready ? " The memory tables are not in this database yet, so nothing is recorded." : ""}
          </p>
          {data.tables_ready ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Users with memory" value={data.users_with_memory ?? 0} />
                <Stat label="Papers recorded" value={data.papers_in_window ?? 0} hint={`last ${data.days} days`} />
                <Stat label="Lists measured" value={data.answer_sets?.listed ?? 0} hint={`of ${data.approved_templates ?? 0} approved templates`} />
                <Stat label="Faults and forced repeats" value={data.faults_7d ?? 0} hint="last 7 days, should be 0" />
              </div>
              <h3 className="mt-6 text-sm font-extrabold text-slate-900">Flags in the last {data.days} days</h3>
              <div className="mt-2 flex flex-wrap gap-3">
                {Object.keys(FLAG_TEXT).map((kind) => (
                  <div key={kind} className="flex items-center gap-2 rounded-lg border border-violet-100 bg-white px-3 py-2">
                    {flagBadge(kind)}
                    <span className="text-sm font-extrabold text-slate-900">{data.events_by_kind?.[kind] ?? 0}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function TemplatesTab() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("near");
  const { data, error, loading } = useLoad(() => api.getMemoryTemplates({ search: search.trim() || undefined, sort }), [search, sort]);
  const rows: MemoryTemplateRow[] = data?.items ?? [];
  return (
    <section className={panel}>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Template code
          <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
        </label>
        <label className="grid gap-1 text-xs font-bold text-slate-600">
          Sort by
          <select className={input} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="near">Most users close to using it up</option>
            <option value="restarted">Most users who finished the list</option>
            <option value="users">Most users</option>
            <option value="serves">Most questions served</option>
          </select>
        </label>
      </div>
      <Status error={error} loading={loading} />
      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>Template</th>
                <th className={th}>Level</th>
                <th className={th}>Answers in list</th>
                <th className={th}>Users</th>
                <th className={th}>Close to done</th>
                <th className={th}>Finished once</th>
                <th className={th}>What to do</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.template_code}>
                  <td className={td}>
                    <div className="font-bold">{r.template_code}</div>
                    <div className="text-xs text-slate-500">{[r.topic, r.subtopic].filter(Boolean).join(" / ")}</div>
                  </td>
                  <td className={td}>{[r.difficulty, r.marks != null ? `${r.marks}m` : null].filter(Boolean).join(" ")}</td>
                  <td className={td}>{r.pool_size ? r.pool_size.toLocaleString() : r.mode === "ring" ? "not measured" : "-"}</td>
                  <td className={td}>{r.users}</td>
                  <td className={td}>{r.near_users}</td>
                  <td className={td}>{r.restarted_users}</td>
                  <td className={`${td} max-w-xs text-xs`}>{r.suggestion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : !loading && !error ? (
        <p className="mt-4 text-sm font-bold text-slate-500">No usage recorded yet.</p>
      ) : null}
    </section>
  );
}

function SupplyTab({ days }: { days: number }) {
  const { data, error, loading } = useLoad(() => api.getMemorySupply(days), [days]);
  const rows: MemorySupplyRow[] = data?.items ?? [];
  return (
    <section className={panel}>
      <p className="mb-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
        What users asked for that the catalogue could not fully give, biggest first. Use this to decide what to ingest next: more hard questions, more easy ones, or more skill paths.
      </p>
      <Status error={error} loading={loading} />
      {rows.length > 0 ? (
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Topic</th>
              <th className={th}>Level</th>
              <th className={th}>Paper marks</th>
              <th className={th}>Where</th>
              <th className={th}>Times asked</th>
              <th className={th}>Questions short</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className={`${td} font-bold`}>{r.topic}</td>
                <td className={td}>{r.difficulty}</td>
                <td className={td}>{r.marks_bucket ? `${r.marks_bucket}+` : "-"}</td>
                <td className={td}>{r.path.replace(/_/g, " ")}</td>
                <td className={td}>{r.requests}</td>
                <td className={td}>{r.forced}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading && !error ? (
        <p className="text-sm font-bold text-slate-500">No gaps recorded in this period.</p>
      ) : null}
    </section>
  );
}

function FlagsTab({ days }: { days: number }) {
  const [kinds, setKinds] = useState<string[]>(["fault", "forced_repeat"]);
  const [offset, setOffset] = useState(0);
  const { data, error, loading } = useLoad(() => api.getMemoryEvents({ kinds, days, offset }), [kinds.join(","), days, offset]);
  const rows: MemoryEventRow[] = data?.items ?? [];
  const router = useRouter();
  return (
    <section className={panel}>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.keys(FLAG_TEXT).map((kind) => {
          const on = kinds.includes(kind);
          return (
            <button
              key={kind}
              type="button"
              className={on ? primaryButton : secondaryButton}
              onClick={() => {
                setOffset(0);
                setKinds((prev) => (on ? prev.filter((k) => k !== kind) : [...prev, kind]));
              }}
            >
              {FLAG_TEXT[kind].label}
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-xs font-semibold text-slate-500">Fault and Forced repeat should normally be empty. Any row there is a bug to fix.</p>
      <Status error={error} loading={loading} />
      {rows.length > 0 ? (
        <>
          <table className={table}>
            <thead>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Flag</th>
                <th className={th}>User</th>
                <th className={th}>Template</th>
                <th className={th}>Where</th>
                <th className={th}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={td}>{when(r.created_at)}</td>
                  <td className={td}>{flagBadge(r.kind)}</td>
                  <td className={td}>
                    <button type="button" className="font-bold text-purple-700 underline" onClick={() => router.push(`/question-memory?tab=user&user=${encodeURIComponent(r.user_id)}`)}>
                      {r.user_id.slice(0, 12)}
                    </button>
                  </td>
                  <td className={`${td} text-xs`}>{r.template_code ?? "-"}</td>
                  <td className={td}>{(r.path ?? "").replace(/_/g, " ")}</td>
                  <td className={`${td} text-xs`}>{Object.entries(r.detail || {}).map(([k, v]) => `${k}: ${String(v)}`).join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex items-center gap-3 text-sm font-bold text-slate-600">
            <button type="button" className={secondaryButton} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 100))}>Newer</button>
            <span>{offset + 1}-{offset + rows.length} of {data?.total ?? 0}</span>
            <button type="button" className={secondaryButton} disabled={offset + rows.length >= (data?.total ?? 0)} onClick={() => setOffset(offset + 100)}>Older</button>
          </div>
        </>
      ) : !loading && !error ? (
        <p className="text-sm font-bold text-slate-500">Nothing for these flags in this period.</p>
      ) : null}
    </section>
  );
}

function UserTab({ initialUser }: { initialUser: string }) {
  const [userId, setUserId] = useState(initialUser);
  const [active, setActive] = useState(initialUser);
  const [view, setView] = useState<MemoryUserView | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError("");
    try {
      setView(await api.getMemoryUser(id.trim()));
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : "Could not load this user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void load(active);
  }, [active, load]);

  async function reset(scope: { template_code?: string; topic?: string }) {
    setMessage("");
    try {
      const result = await api.resetMemoryUser(active, { reason: reason.trim(), ...scope });
      setMessage(`Restarted ${result.rows_reset} list(s). They will see a fresh order from now on.`);
      await load(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset.");
    }
  }

  async function saveSettings(enabled: boolean, rotation: "off" | "soft") {
    setMessage("");
    try {
      await api.saveMemoryUserSettings(active, { reason: reason.trim(), enabled, rotation });
      setMessage("Settings saved.");
      await load(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings.");
    }
  }

  const reasonOk = reason.trim().length >= 8;
  return (
    <section className={panel}>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setActive(userId.trim());
        }}
      >
        <label className="grid min-w-[16rem] flex-1 gap-1 text-xs font-bold text-slate-600">
          User id
          <input className={input} value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="Paste a user id (from Users or User 360)" />
        </label>
        <button type="submit" className={primaryButton}>Look up</button>
      </form>
      <Status error={error} loading={loading} />
      {message ? <p className={`${notice} mt-4`}>{message}</p> : null}
      {view ? (
        <div className="mt-5 grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Papers made" value={view.paper_count} />
            <Stat label="Templates seen" value={view.templates.length} />
            <Stat label="Questions served" value={view.templates.reduce((a, t) => a + t.served_count, 0)} />
          </div>

          <div className="rounded-xl border border-violet-200 p-4">
            <h3 className="text-sm font-extrabold text-slate-900">Actions (a reason is recorded in the audit trail)</h3>
            <label className="mt-2 grid gap-1 text-xs font-bold text-slate-600">
              Reason (at least 8 characters)
              <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why are you doing this?" />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={secondaryButton} disabled={!reasonOk} onClick={() => void reset({})}>Restart every list for this user</button>
              {Object.keys(view.by_topic).map((topic) => (
                <button key={topic} type="button" className={secondaryButton} disabled={!reasonOk} onClick={() => void reset({ topic })}>Restart {topic}</button>
              ))}
              <button type="button" className={secondaryButton} disabled={!reasonOk} onClick={() => void saveSettings(!view.settings.enabled, view.settings.rotation)}>
                {view.settings.enabled ? "Turn memory off for this user" : "Turn memory on for this user"}
              </button>
              <button type="button" className={secondaryButton} disabled={!reasonOk} onClick={() => void saveSettings(view.settings.enabled, view.settings.rotation === "soft" ? "off" : "soft")}>
                Template rotation: {view.settings.rotation === "soft" ? "on (click to turn off)" : "off (click to turn on)"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Template</th>
                  <th className={th}>Level</th>
                  <th className={th}>Served</th>
                  <th className={th}>Progress through list</th>
                  <th className={th}>Round</th>
                  <th className={th}>Last</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {view.templates.map((t) => (
                  <tr key={t.template_code}>
                    <td className={td}>
                      <div className="font-bold">{t.template_code}</div>
                      <div className="text-xs text-slate-500">{[t.topic, t.subtopic].filter(Boolean).join(" / ")}</div>
                    </td>
                    <td className={td}>{[t.difficulty, t.marks != null ? `${t.marks}m` : null].filter(Boolean).join(" ")}</td>
                    <td className={td}>{t.served_count}</td>
                    <td className={td}>
                      {t.pool_size ? (
                        <div className="w-40">
                          <div className="h-2 rounded bg-violet-100"><div className="h-2 rounded bg-purple-600" style={{ width: `${Math.round((t.progress ?? 0) * 100)}%` }} /></div>
                          <div className="mt-1 text-xs text-slate-500">{t.position} of {t.pool_size}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">not measured (short memory)</span>
                      )}
                    </td>
                    <td className={td}>{t.round != null ? t.round + 1 : "-"}</td>
                    <td className={td}>{when(t.last_served_at)}</td>
                    <td className={td}>
                      <button type="button" className="text-xs font-bold text-purple-700 underline disabled:opacity-40" disabled={!reasonOk} onClick={() => void reset({ template_code: t.template_code })}>Restart</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Recent papers</h3>
            <ul className="mt-2 grid gap-1 text-sm text-slate-700">
              {view.papers.map((p) => (
                <li key={p.paper_id}>
                  #{p.paper_seq} {when(p.created_at)} - {p.path.replace(/_/g, " ")} - {p.items.length} questions ({Array.from(new Set(p.items.map((i) => i.tp).filter(Boolean))).join(", ") || "-"})
                </li>
              ))}
              {view.papers.length === 0 ? <li className="text-slate-500">No papers recorded in the retention window.</li> : null}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-extrabold text-slate-900">Flags for this user</h3>
            <ul className="mt-2 grid gap-1 text-sm text-slate-700">
              {view.events.map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  {flagBadge(e.kind)} <span>{when(e.created_at)}</span> <span className="text-xs text-slate-500">{e.template_code ?? e.topic ?? ""}</span>
                </li>
              ))}
              {view.events.length === 0 ? <li className="text-slate-500">None.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default function QuestionMemoryPage() {
  const router = useRouter();
  const queryTab = typeof router.query.tab === "string" ? (router.query.tab as Tab) : "summary";
  const queryUser = typeof router.query.user === "string" ? router.query.user : "";
  const [tab, setTab] = useState<Tab>("summary");
  const [days, setDays] = useState(30);
  useEffect(() => {
    if (TABS.some((t) => t.id === queryTab)) setTab(queryTab);
  }, [queryTab]);

  return (
    <AppShell title="Question Memory">
      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">What each user has already been given</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Every question a signed-in user gets is remembered, so answers do not repeat until their whole list for that template is used, then the list restarts with different numbers and wording. Teachers never see these flags. Use this page to see which lists are running low and what to ingest next.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {TABS.map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? primaryButton : secondaryButton} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
          <select className={`${input} !w-auto`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </section>
      {tab === "summary" ? <SummaryTab days={days} /> : null}
      {tab === "templates" ? <TemplatesTab /> : null}
      {tab === "supply" ? <SupplyTab days={days} /> : null}
      {tab === "flags" ? <FlagsTab days={days} /> : null}
      {tab === "user" ? <UserTab key={queryUser} initialUser={queryUser} /> : null}
    </AppShell>
  );
}

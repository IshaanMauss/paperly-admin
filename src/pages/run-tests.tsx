import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { SignInCodesPanel } from "@/components/SignInCodesPanel";
import { input, panel, primaryButton, secondaryButton } from "@/components/ui";
import { api } from "@/lib/apiClient";
import type { TestCenterOverview, TestCheckResult, TestCheckRow, TestCoverage, TestDatabaseReport, TestRunRecord } from "@/lib/apiTypes";

type Filter = "all" | "fail" | "pass" | "never" | "flaky";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pass: { label: "Passed", cls: "bg-emerald-100 text-emerald-800" },
  fail: { label: "Failed", cls: "bg-rose-100 text-rose-700" },
  warn: { label: "Needs a look", cls: "bg-amber-100 text-amber-800" },
  skipped: { label: "Skipped", cls: "bg-slate-200 text-slate-700" },
  blocked: { label: "Blocked for safety", cls: "bg-indigo-100 text-indigo-800" },
  never: { label: "Never run", cls: "bg-slate-100 text-slate-500" },
};

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  return (
    <span className="inline-flex h-4 items-end gap-0.5" title={`Last runs (ms): ${values.join(", ")}`}>
      {values.map((v, i) => (
        <span key={i} className="w-1 rounded-sm bg-violet-300" style={{ height: `${Math.max(12, (v / max) * 100)}%` }} />
      ))}
    </span>
  );
}

function FailureBox({ result }: { result: TestCheckResult }) {
  const err = result.error;
  return (
    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm">
      <p className="font-extrabold text-rose-800">What went wrong</p>
      <p className="mt-1 font-semibold text-slate-800">{result.detail}</p>
      {result.fix ? (
        <>
          <p className="mt-2 font-extrabold text-rose-800">What to do</p>
          <p className="mt-1 font-semibold text-slate-800">{result.fix}</p>
        </>
      ) : null}
      {err?.file ? (
        <>
          <p className="mt-2 font-extrabold text-rose-800">Where in the code</p>
          <p className="mt-1 font-semibold text-slate-700">
            File <span className="font-mono">{err.file}</span>, line <span className="font-mono">{err.line}</span>
            {err.function ? <> (in <span className="font-mono">{err.function}</span>)</> : null}
          </p>
          {err.code.length ? (
            <pre className="mt-2 overflow-x-auto rounded-md bg-white p-2 text-xs leading-5">
              {err.code.map((row) => (
                <div key={row.n} className={row.hit ? "bg-rose-200 font-bold text-rose-900" : "text-slate-600"}>
                  {String(row.n).padStart(5, " ")}  {row.text}
                </div>
              ))}
            </pre>
          ) : null}
        </>
      ) : null}
      {err?.technical ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-extrabold text-slate-500">Technical detail (for the developer)</summary>
          <p className="mt-1 break-words font-mono text-xs text-slate-600">{err.error_type}: {err.technical}</p>
        </details>
      ) : null}
    </div>
  );
}

function CheckCard({ row, live, busy, onRun, onRemove }: { row: TestCheckRow; live?: TestCheckResult; busy: boolean; onRun: () => void; onRemove: () => void }) {
  const result = live || row.last;
  const key = result ? result.status : "never";
  const style = STATUS_STYLE[key];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-extrabold text-slate-900">{row.title}</h4>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${style.cls}`}>{style.label}</span>
            {row.mode === "write" ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">Writes test data (test database only)</span>
            ) : (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">Read-only</span>
            )}
            {row.flaky ? <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-extrabold text-orange-800" title="Passed and failed in recent runs">Flaky</span> : null}
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{row.what}</p>
          {result ? (
            <p className="mt-1 text-xs font-semibold text-slate-600">
              {result.status === "pass" || result.status === "skipped" ? result.detail : null}
              {result.status === "blocked" ? <span className="text-indigo-700">{result.detail} {result.fix}</span> : null}
              {result.ms != null ? <span className="ml-2 text-slate-400">{result.ms} ms</span> : null}
              {result.at ? <span className="ml-2 text-slate-400">last run {new Date(result.at).toLocaleString()}</span> : null}
              <span className="ml-2 align-middle"><Spark values={row.durations} /></span>
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {row.removable ? <button type="button" onClick={onRemove} className={secondaryButton}>Remove</button> : null}
          <button type="button" onClick={onRun} disabled={busy} className={primaryButton}>Run</button>
        </div>
      </div>
      {result && (result.status === "fail" || result.status === "warn") ? <FailureBox result={result} /> : null}
    </div>
  );
}


function TestDatabasePanel({ env, onChanged, setNotice }: { env?: TestCenterOverview["environment"]; onChanged: () => void; setNotice: (text: string | null) => void }) {
  const [info, setInfo] = useState<TestDatabaseReport | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setInfo(await api.getTestDatabase());
    } catch {
      setInfo(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const act = async (kind: "seed" | "wipe") => {
    setBusy(true);
    try {
      if (kind === "seed") {
        const result = await api.seedTestDatabase();
        setNotice(`Created ${result.users.length} sample users and a sample institute (join code ${result.join_code}). All sample users use the password shown below.`);
      } else {
        const result = await api.wipeTestDatabase();
        setNotice(`Removed ${result.users} test users, ${result.institutes} institutes and ${result.promo_codes} promo codes.`);
      }
      await refresh();
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };

  const safe = info?.safe ?? env?.test_database?.safe ?? false;
  const reasons = info?.reasons ?? env?.test_database?.reasons ?? [];
  return (
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900">Test database</h3>
          <p className="max-w-3xl text-sm font-semibold text-slate-600">
            Write tests create fake users, institutes and promo codes, so they only run on a test database on your own computer. They are locked on the live server by design - the lock cannot be switched off from here.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${safe ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>{safe ? "Unlocked: this is the test database" : "Locked: this is not the test database"}</span>
      </div>
      {safe && info ? (
        <div className="mt-4">
          <p className="text-sm font-bold text-slate-700">
            Right now: {info.counts?.users ?? 0} test users, {info.counts?.institutes ?? 0} test institutes, {info.counts?.promo_codes ?? 0} test promo codes. Sample login password: <span className="font-mono">{info.sample_password}</span>. Institute join code: <span className="font-mono">{info.join_code}</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className={primaryButton} disabled={busy} onClick={() => act("seed")}>Create sample data</button>
            <button type="button" className={secondaryButton} disabled={busy} onClick={() => act("wipe")}>Remove all test data</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-900">
          <p className="font-extrabold">Why it is locked</p>
          <ul className="mt-1 list-disc pl-5">
            {reasons.map((r) => (<li key={r}>{r}</li>))}
          </ul>
          <p className="mt-3 font-extrabold">How to unlock it (on your computer)</p>
          <ol className="mt-1 list-decimal pl-5">
            <li>In the backend folder run <span className="font-mono">python scripts/local_test_db.py up</span> (builds the test database).</li>
            <li>Run <span className="font-mono">python scripts/local_test_db.py backend</span> (starts a local backend on port 8100 using it).</li>
            <li>Start a second copy of this admin panel pointing at it: set <span className="font-mono">NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8100/api</span> and run it on another port. Sign in with the test admin the script prints.</li>
          </ol>
        </div>
      )}
    </section>
  );
}

export default function RunTestsPage() {
  const [data, setData] = useState<TestCenterOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [run, setRun] = useState<TestRunRecord | null>(null);
  const [coverage, setCoverage] = useState<TestCoverage | null>(null);
  const [coverageBusy, setCoverageBusy] = useState(false);
  const [gapSearch, setGapSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await api.getTestCenter();
      setData(next);
      if (next.active_run) setRun(next.active_run);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the test center.");
    }
  }, []);

  useEffect(() => {
    load();
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [load]);

  const running = run?.status === "running";

  const poll = useCallback(
    (runId: string) => {
      const tick = async () => {
        try {
          const next = await api.getTestRun(runId);
          setRun(next);
          if (next.status === "running") {
            timer.current = window.setTimeout(tick, 1500);
          } else {
            await load();
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Lost track of the test run.");
        }
      };
      timer.current = window.setTimeout(tick, 800);
    },
    [load]
  );

  useEffect(() => {
    if (run?.status === "running" && !timer.current) poll(run.id);
  }, [run?.id, run?.status, poll]);

  const start = async (ids?: string[]) => {
    setNotice(null);
    try {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = null;
      const record = await api.startTestRun(ids);
      setRun(record);
      poll(record.id);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not start the run.");
    }
  };

  const loadCoverage = async () => {
    setCoverageBusy(true);
    try {
      setCoverage(await api.getTestCoverage());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not scan the code.");
    } finally {
      setCoverageBusy(false);
    }
  };

  const addTest = async (kind: "function" | "route", target: string) => {
    try {
      await api.addCustomTest(kind, target);
      setNotice(`Added a basic check for ${target}. Find it under "Added by you".`);
      await Promise.all([load(), loadCoverage()]);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not add the check.");
    }
  };

  const removeTest = async (id: string) => {
    try {
      await api.removeCustomTest(id);
      await load();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not remove the check.");
    }
  };

  const live = run?.results || {};
  const matches = useCallback(
    (row: TestCheckRow) => {
      const q = search.trim().toLowerCase();
      if (q && !`${row.title} ${row.what} ${row.section} ${row.id}`.toLowerCase().includes(q)) return false;
      const status: string = (live[row.id] || row.last)?.status || "never";
      if (filter === "fail") return status === "fail" || status === "warn";
      if (filter === "pass") return status === "pass";
      if (filter === "never") return status === "never";
      if (filter === "flaky") return row.flaky;
      return true;
    },
    [search, filter, live]
  );

  const grouped = useMemo(() => {
    if (!data) return [];
    return data.sections
      .map((section) => ({ section, rows: data.checks.filter((c) => c.section === section && matches(c)), all: data.checks.filter((c) => c.section === section) }))
      .filter((g) => g.all.length);
  }, [data, matches]);

  const totals = useMemo(() => {
    const t = { pass: 0, fail: 0, warn: 0, never: 0 };
    (data?.checks || []).forEach((c) => {
      const s = (live[c.id] || c.last)?.status;
      if (s === "pass") t.pass += 1;
      else if (s === "fail") t.fail += 1;
      else if (s === "warn") t.warn += 1;
      else if (!s) t.never += 1;
    });
    return t;
  }, [data, live]);

  const percent = run && run.total ? Math.round((run.done / run.total) * 100) : 0;
  const currentTitle = data?.checks.find((c) => c.id === run?.current)?.title;
  const env = data?.environment;
  const isProd = env?.production ?? env?.production_like;

  const gapFilter = (text: string) => !gapSearch.trim() || text.toLowerCase().includes(gapSearch.trim().toLowerCase());

  return (
    <AppShell title="Run Tests">
      <section className={panel}>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-700">Operations</p>
        <h2 className="mt-1 text-3xl font-extrabold text-slate-950">Is Paperly working?</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Press Run on any check, or run everything. Read-only checks never change anything. Write tests only run on a local test database and are locked on the live server. If something fails you get the plain-words reason, the file and the line.
          Heavy load tests, real browser tests and payment tests come in a later step.
        </p>
        {env ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-extrabold">
            <span className={`rounded-full px-3 py-1 ${isProd ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800"}`}>Environment: {env.environment}{isProd ? " (live)" : ""}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Razorpay: {env.razorpay_mode}</span>
            {env.database_host ? <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">Database: {env.database_host}</span> : null}
            {env.test_database ? (
              <span className={`rounded-full px-3 py-1 ${env.test_database.safe ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"}`}>
                {env.test_database.safe ? "Test database: write tests unlocked" : "Live database: write tests locked"}
              </span>
            ) : null}
          </div>
        ) : null}
        {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}
        {notice ? <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-800">{notice}</div> : null}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3"><div className="text-2xl font-extrabold text-emerald-800">{totals.pass}</div><div className="text-xs font-bold uppercase text-emerald-700">Passed</div></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3"><div className="text-2xl font-extrabold text-rose-700">{totals.fail}</div><div className="text-xs font-bold uppercase text-rose-700">Failed</div></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="text-2xl font-extrabold text-amber-800">{totals.warn}</div><div className="text-xs font-bold uppercase text-amber-700">Need a look</div></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="text-2xl font-extrabold text-slate-700">{totals.never}</div><div className="text-xs font-bold uppercase text-slate-500">Never run</div></div>
        </div>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${input} md:flex-1`} placeholder="Search checks: login, payment, template, security..." />
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className={`${input} md:w-48`}>
            <option value="all">All results</option>
            <option value="fail">Failed or need a look</option>
            <option value="pass">Passed</option>
            <option value="never">Never run</option>
            <option value="flaky">Flaky</option>
          </select>
          <button type="button" disabled={running || !data} onClick={() => start()} className={primaryButton}>Run everything</button>
        </div>

        {run ? (
          <div className="mt-4 rounded-xl border border-violet-200 bg-white p-4">
            <div className="flex items-center justify-between text-sm font-extrabold text-slate-800">
              <span>{running ? `Running${currentTitle ? `: ${currentTitle}` : "..."}` : run.status === "crashed" ? "The run stopped unexpectedly" : "Finished"}</span>
              <span>{run.done} of {run.total} ({percent}%)</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-violet-100">
              <div className={`h-full rounded-full transition-all ${run.status === "crashed" ? "bg-rose-500" : "bg-purple-600"}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      {!data && !error ? <section className={panel}><p className="text-sm font-bold text-slate-600">Loading checks...</p></section> : null}

      {grouped.map(({ section, rows, all }) => {
        const pass = all.filter((c) => (live[c.id] || c.last)?.status === "pass").length;
        const bad = all.filter((c) => ["fail", "warn"].includes((live[c.id] || c.last)?.status || "")).length;
        return (
          <section key={section} className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">{section}</h3>
                <p className="text-xs font-bold text-slate-500">{all.length} checks - {pass} passed - {bad} need attention</p>
              </div>
              <button type="button" disabled={running} onClick={() => start(all.map((c) => c.id))} className={secondaryButton}>Run this section</button>
            </div>
            <div className="mt-4 space-y-3">
              {rows.map((row) => (
                <CheckCard key={row.id} row={row} live={live[row.id]} busy={running} onRun={() => start([row.id])} onRemove={() => removeTest(row.id)} />
              ))}
              {rows.length === 0 ? <p className="text-sm font-semibold text-slate-500">Nothing here matches your search or filter.</p> : null}
            </div>
          </section>
        );
      })}

      <SignInCodesPanel />

      <TestDatabasePanel env={env} onChanged={load} setNotice={setNotice} />

      <section className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Not tested yet</h3>
            <p className="max-w-3xl text-sm font-semibold text-slate-600">
              Scans the code for backend functions and API endpoints that no test or check mentions. If someone added a function and nothing tests it, it shows up here. Add a basic check with one click: it confirms the function or endpoint still exists and warns you if its inputs change.
            </p>
          </div>
          <button type="button" onClick={loadCoverage} disabled={coverageBusy} className={primaryButton}>{coverageBusy ? "Scanning..." : coverage ? "Scan again" : "Scan the code"}</button>
        </div>
        {coverage ? (
          <div className="mt-4">
            <p className="text-sm font-bold text-slate-700">
              {coverage.routes_total} endpoints ({coverage.admin_routes_guarded} admin endpoints confirmed sign-in protected), {coverage.routes_untested.length} not mentioned by any test. {coverage.functions_total} service functions, {coverage.functions_untested.length} not mentioned by any test.
            </p>
            <input value={gapSearch} onChange={(e) => setGapSearch(e.target.value)} className={`${input} mt-3`} placeholder="Search untested functions and endpoints..." />
            <h4 className="mt-4 text-sm font-extrabold text-slate-900">Functions</h4>
            <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
              {coverage.functions_untested.filter((f) => gapFilter(`${f.module} ${f.name}`)).slice(0, 200).map((f) => (
                <div key={f.target} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 break-all"><span className="font-extrabold text-slate-800">{f.name}</span> <span className="text-xs font-semibold text-slate-500">{f.file}:{f.line}</span></span>
                  <button type="button" onClick={() => addTest("function", f.target)} className={secondaryButton}>Add a test</button>
                </div>
              ))}
            </div>
            <h4 className="mt-4 text-sm font-extrabold text-slate-900">Endpoints</h4>
            <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
              {coverage.routes_untested.filter((r) => gapFilter(`${r.method} ${r.path} ${r.name}`)).slice(0, 200).map((r) => (
                <div key={r.target} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 break-all"><span className="font-extrabold text-slate-800">{r.method}</span> {r.path}</span>
                  <button type="button" onClick={() => addTest("route", r.target)} className={secondaryButton}>Add a test</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

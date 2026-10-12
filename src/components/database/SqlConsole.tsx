import { useEffect, useRef, useState } from "react";

import { input, primaryButton, secondaryButton } from "@/components/ui";
import { api } from "@/lib/apiClient";
import type { DbReview, DbRunResponse, DbTarget } from "@/lib/apiTypes";

import { Pill, ResultGrid, SectionTitle } from "./dbUi";

const PRESETS: { label: string; sql: string }[] = [
  { label: "Row count per table", sql: "SELECT relname AS table_name, n_live_tup AS rows_estimate\nFROM pg_stat_user_tables\nORDER BY n_live_tup DESC;" },
  { label: "Newest papers", sql: "SELECT id, title, syllabus_code, topic, question_count, created_at\nFROM worksheets\nORDER BY created_at DESC\nLIMIT 20;" },
  { label: "Plan status counts", sql: "SELECT plan_code, status, count(*) AS teachers\nFROM teacher_subscriptions\nGROUP BY plan_code, status\nORDER BY teachers DESC;" },
  { label: "Approved templates by topic", sql: "SELECT topic, count(*) AS templates\nFROM templates\nWHERE status = 'approved'\nGROUP BY topic\nORDER BY templates DESC;" },
  { label: "Slow or stuck connections", sql: "SELECT pid, state, now() - query_start AS running_for, left(query, 120) AS query\nFROM pg_stat_activity\nWHERE datname = current_database() AND state <> 'idle'\nORDER BY query_start;" },
];

const riskTone = { read: "good", write: "warn", high: "bad", critical: "bad", blocked: "bad" } as const;
const riskText = { read: "Read only", write: "Changes data", high: "High risk", critical: "Changes structure", blocked: "Not allowed" } as const;

type Dialog = { review: DbReview; step: 1 | 2 };

export function SqlConsole({ target, locked }: { target: DbTarget; locked: boolean }) {
  const [sql, setSql] = useState(PRESETS[0].sql);
  const [enforceRls, setEnforceRls] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<DbRunResponse | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [phrase, setPhrase] = useState("");
  const [second, setSecond] = useState("");
  const [password, setPassword] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const prod = target === "production";

  useEffect(() => {
    setOutcome(null);
    setError(null);
    setBlocked(null);
    setDialog(null);
  }, [target]);

  function remember(statement: string) {
    setRecent((cur) => [statement, ...cur.filter((s) => s !== statement)].slice(0, 8));
  }

  function resetDialog() {
    setDialog(null);
    setPhrase("");
    setSecond("");
    setPassword("");
    setDialogError(null);
  }

  async function run() {
    if (!sql.trim() || busy || locked) return;
    setBusy(true);
    setError(null);
    setBlocked(null);
    setOutcome(null);
    try {
      const body = { sql, enforce_rls: enforceRls, teacher_id: teacherId.trim() || null };
      const review = await api.reviewDbStatement(target, body);
      if (!review.can_run) {
        setBlocked(review.analysis.blocked_reason || review.dry_run_error || "That statement cannot run.");
        if (review.dry_run_error) setError(`The preview failed, so nothing was changed: ${review.dry_run_error}`);
        return;
      }
      remember(sql);
      if (!review.requires_confirmation) {
        setOutcome(await api.runDbStatement(target, body));
        return;
      }
      setDialog({ review, step: 1 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "The statement failed.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!dialog) return;
    setBusy(true);
    setDialogError(null);
    try {
      const res = await api.runDbStatement(target, {
        sql,
        enforce_rls: enforceRls,
        teacher_id: teacherId.trim() || null,
        review_token: dialog.review.review_token,
        phrase,
        second_phrase: second,
        password,
      });
      setOutcome(res);
      resetDialog();
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : "The statement failed.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  const review = dialog?.review;
  const needSecond = Boolean(review?.second_phrase);
  const canConfirm = Boolean(review && phrase === review.phrase && (!needSecond || second === review.second_phrase) && password.length > 0 && !busy);

  return (
    <div className="grid gap-4">
      <div className={`rounded-xl border-l-4 p-4 text-sm font-semibold ${prod ? "border-rose-600 bg-rose-50 text-rose-800" : "border-emerald-600 bg-emerald-50 text-emerald-800"}`}>
        {prod
          ? "You are connected to PRODUCTION. Reading is safe. Anything that changes data needs a preview, two typed confirmations for risky changes, and your password. Every change is logged."
          : "You are connected to the TEST database. Changes here do not touch production, but they still need a preview and your password."}
      </div>

      <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
        <SectionTitle hint="One statement at a time. SELECT runs straight away. INSERT, UPDATE, DELETE and structure changes are previewed first (nothing is changed by the preview).">SQL console</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p.label} className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-purple-700 hover:bg-violet-100" onClick={() => setSql(p.sql)}>
              {p.label}
            </button>
          ))}
        </div>
        <textarea
          ref={areaRef}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void run();
            }
          }}
          spellCheck={false}
          rows={9}
          aria-label="SQL statement"
          className="w-full rounded-lg border border-violet-200 bg-slate-950 p-3 font-mono text-[13px] leading-5 text-violet-100 outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100"
          placeholder="SELECT * FROM templates LIMIT 10;"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button className={primaryButton} onClick={() => void run()} disabled={busy || locked || !sql.trim()}>
            {busy && !dialog ? "Checking..." : "Review and run"}
          </button>
          <span className="text-xs font-semibold text-slate-500">Ctrl+Enter also runs it. Time limit 15 seconds, at most 500 rows shown.</span>
        </div>
        <details className="mt-3 rounded-lg bg-violet-50/60 p-3 text-sm">
          <summary className="cursor-pointer font-bold text-slate-700">Test row-level security (optional)</summary>
          <label className="mt-2 flex items-center gap-2 font-semibold text-slate-700">
            <input type="checkbox" checked={enforceRls} onChange={(e) => setEnforceRls(e.target.checked)} />
            Run as the teacher app's limited role, so policies are enforced like a real teacher request
          </label>
          <input className={`${input} mt-2 max-w-md`} value={teacherId} onChange={(e) => setTeacherId(e.target.value)} placeholder="Teacher id to act as (for example t_...)" disabled={!enforceRls} aria-label="Teacher id" />
          <p className="mt-2 text-xs font-medium text-slate-500">Without this the console uses the app's own database role, which bypasses row-level security.</p>
        </details>
        {recent.length ? (
          <div className="mt-3">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Recent in this session</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button key={r} className="max-w-[16rem] truncate rounded border border-violet-100 bg-white px-2 py-1 font-mono text-[11px] text-slate-600 hover:bg-violet-50" onClick={() => setSql(r)} title={r}>
                  {r.replace(/\s+/g, " ")}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {blocked ? (
        <div className="rounded-xl border border-rose-200 border-l-4 border-l-rose-600 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
          <Pill tone="bad">Not allowed</Pill> <span className="ml-1">{blocked}</span>
        </div>
      ) : null}
      {error && !blocked ? <div className="rounded-xl border border-rose-200 border-l-4 border-l-rose-600 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div> : null}
      {error && blocked ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div> : null}

      {outcome ? (
        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-slate-950">{outcome.changed ? "Change applied" : "Result"}</h3>
            <Pill tone={riskTone[outcome.analysis.risk]}>{riskText[outcome.analysis.risk]}</Pill>
            {outcome.tables.map((t) => (
              <Pill key={t.name} tone="info">
                {t.label}
              </Pill>
            ))}
          </div>
          {outcome.changed ? (
            <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
              Committed on the {prod ? "production" : "test"} database{typeof outcome.result.rows_affected === "number" ? `: ${outcome.result.rows_affected} row${outcome.result.rows_affected === 1 ? "" : "s"} affected` : ""}. It is recorded in History.
            </p>
          ) : null}
          {outcome.changed ? outcome.result.returning ? <ResultGrid data={outcome.result.returning} /> : null : <ResultGrid data={outcome.result} />}
        </section>
      ) : null}

      {dialog && review ? (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Confirm database change">
          <button aria-label="Cancel" className="absolute inset-0 bg-slate-950/50" onClick={resetDialog} />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-violet-200 bg-white p-6 shadow-card">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-slate-950">Confirm change on {prod ? "PRODUCTION" : "the test database"}</h3>
              <Pill tone={riskTone[review.analysis.risk]}>{riskText[review.analysis.risk]}</Pill>
            </div>

            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5 text-violet-100">{review.statement}</pre>

            <div className="mt-3 grid gap-2 text-sm">
              <p className="font-bold text-slate-900">
                Preview: this would affect {typeof review.rows_affected === "number" ? `${review.rows_affected} row${review.rows_affected === 1 ? "" : "s"}` : "an unknown number of rows"}. Nothing has been changed yet.
              </p>
              {review.analysis.notes.map((n) => (
                <p key={n} className="rounded-lg bg-amber-50 p-2 font-semibold text-amber-800">
                  {n}
                </p>
              ))}
              {review.tables.length ? (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Tables involved</p>
                  <ul className="grid gap-1">
                    {review.tables.map((t) => (
                      <li key={t.name} className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-100 px-3 py-1.5">
                        <span className="font-bold">{t.label}</span>
                        <span className="font-mono text-[11px] text-slate-400">{t.name}</span>
                        <Pill tone={t.rls_enabled ? "good" : "warn"}>{t.rls_enabled ? `RLS on, ${t.policies} policies` : "RLS off"}</Pill>
                        <Pill tone={t.guarded ? "good" : "neutral"}>{t.guarded ? "data guard active" : "no data guard"}</Pill>
                        <span className="text-xs font-semibold text-slate-500">about {t.rows_estimate.toLocaleString("en-US")} rows</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {review.enforce_rls ? <p className="text-xs font-semibold text-slate-500">Running with row-level security enforced{teacherId ? ` as ${teacherId}` : ""}.</p> : <p className="text-xs font-semibold text-slate-500">Running as the app's own database role (row-level security is bypassed).</p>}
            </div>
            {review.returning ? (
              <div className="mt-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Rows returned by the preview</p>
                <ResultGrid data={review.returning} />
              </div>
            ) : null}

            {dialog.step === 1 ? (
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button className={secondaryButton} onClick={resetDialog}>
                  Cancel
                </button>
                <button className={primaryButton} onClick={() => setDialog({ ...dialog, step: 2 })}>
                  I have reviewed this - continue
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
                <p className="text-sm font-extrabold text-rose-800">Second confirmation</p>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Type <span className="font-mono font-extrabold">{review.phrase}</span>
                  <input className={input} value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" spellCheck={false} />
                </label>
                {needSecond ? (
                  <label className="grid gap-1 text-sm font-semibold text-slate-700">
                    This statement is risky. Also type <span className="font-mono font-extrabold">{review.second_phrase}</span>
                    <input className={input} value={second} onChange={(e) => setSecond(e.target.value)} autoComplete="off" spellCheck={false} />
                  </label>
                ) : null}
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Your admin password
                  <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </label>
                {dialogError ? <p className="rounded-lg bg-white p-2 text-sm font-semibold text-rose-700">{dialogError}</p> : null}
                <p className="text-xs font-medium text-slate-500">The review expires {Math.round((review.expires_in_seconds || 300) / 60)} minutes after it was made. If the number of rows changes before you confirm, nothing is applied.</p>
                <div className="flex flex-wrap justify-end gap-2">
                  <button className={secondaryButton} onClick={resetDialog}>
                    Cancel
                  </button>
                  <button className="rounded-lg border border-rose-600 bg-rose-600 px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void confirm()} disabled={!canConfirm}>
                    {busy ? "Applying..." : `Apply on ${prod ? "production" : "test"}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

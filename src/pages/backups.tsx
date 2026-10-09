import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { api, downloadRequest, saveBlob, type BackupHistory } from "@/lib/apiClient";
import { errorNotice, notice, panel, primaryButton, secondaryButton } from "@/components/ui";

const RESTORE_CONFIRMATION = "RESTORE PAPERLY-NT DATABASE FROM BACKUP";

const excelTabs = [
  "Billing Summary",
  "Payments",
  "Customer Contacts",
  "Users",
  "Organizations",
  "Subscriptions",
  "Generated Papers",
  "Template Usage",
  "Support Tickets",
  "Templates",
  "Admin Activity",
  "Security & Risk Events",
  "Security Incidents",
  "User Activity",
  "Offers",
  "Plan Configuration History",
];

type RangeKey = "all" | "today" | "week" | "month30" | "lastMonth" | "thisMonth" | "custom";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "week", label: "Last 7 days" },
  { key: "month30", label: "Last 30 days" },
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "today", label: "Today" },
  { key: "all", label: "Everything" },
  { key: "custom", label: "Pick dates" },
];

function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The first and last day (both included) for a preset, in the browser's calendar; "" means no limit. */
function rangeFor(key: RangeKey, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);
  if (key === "today") return { from: ymd(today), to: ymd(today) };
  if (key === "week") return { from: ymd(daysAgo(6)), to: ymd(today) };
  if (key === "month30") return { from: ymd(daysAgo(29)), to: ymd(today) };
  if (key === "thisMonth") return { from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)), to: ymd(today) };
  if (key === "lastMonth") return { from: ymd(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: ymd(new Date(today.getFullYear(), today.getMonth(), 0)) };
  if (key === "custom") return { from: customFrom, to: customTo };
  return { from: "", to: "" };
}

export default function BackupsPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("month30");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = rangeFor(rangeKey, customFrom, customTo);
  const customInvalid = rangeKey === "custom" && (!customFrom || !customTo || customTo < customFrom);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<BackupHistory | null>(null);

  async function loadHistory() {
    try {
      setHistory(await api.getBackupHistory());
    } catch {
      setHistory(null);
    }
  }
  useEffect(() => {
    void loadHistory();
  }, []);

  // Added 2026-09-28: previously export existed with no restore path at all.
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreFile, setRestoreFile] = useState<Record<string, unknown> | null>(null);
  const [restoreFileName, setRestoreFileName] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const [restorePreview, setRestorePreview] = useState<Record<string, { in_backup: number; would_insert: number; inserted: number; skipped_rows: number; note?: string }> | null>(null);
  const [restoreConfirmText, setRestoreConfirmText] = useState("");
  const [restoreResult, setRestoreResult] = useState("");

  async function onRestoreFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setRestorePreview(null);
    setRestoreResult("");
    setRestoreError("");
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      setRestoreFile(parsed);
      setRestoreFileName(file.name);
    } catch (err) {
      setRestoreError("That file isn't valid JSON from a backup export.");
      setRestoreFile(null);
    }
  }

  async function runDryRun() {
    if (!restoreFile) return;
    setRestoreBusy(true);
    setRestoreError("");
    try {
      const result = await api.restoreBackup(restoreFile, true);
      setRestorePreview(result.tables);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Could not preview this restore.");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function applyRestore() {
    if (!restoreFile) return;
    if (restoreConfirmText !== RESTORE_CONFIRMATION) {
      setRestoreError(`Type "${RESTORE_CONFIRMATION}" exactly to confirm.`);
      return;
    }
    if (!window.confirm("This writes rows into the live database (insert-only, never overwrites an existing row). Continue?")) return;
    setRestoreBusy(true);
    setRestoreError("");
    try {
      const result = await api.restoreBackup(restoreFile, false, restoreConfirmText);
      const totalInserted = Object.values(result.tables).reduce((sum, t) => sum + t.inserted, 0);
      setRestoreResult(`Restore applied - ${totalInserted} row(s) inserted across ${Object.keys(result.tables).length} tables.`);
      setRestorePreview(result.tables);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function exportBackup(format: "xlsx" | "json") {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const params = new URLSearchParams({ format });
      if (format === "xlsx") {
        if (range.from) params.set("date_from", range.from);
        if (range.to) params.set("date_to", range.to);
      }
      const { blob, filename } = await downloadRequest(`/admin/backups/export?${params.toString()}`);
      saveBlob(blob, filename);
      setMessage(`${format === "xlsx" ? "Exported data" : "Backup"} saved as ${filename}.`);
      void loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The download did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Export & Backup">
      {message ? <section className={notice}>{message}</section> : null}
      {error ? <section className={errorNotice}>The download did not work. {error}</section> : null}

      <section className={panel}>
        <h2 className="text-2xl font-extrabold text-slate-950">Export data</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          An Excel workbook for accounts, support and outreach: payments (what was paid, how, bill number, failed or unpaid checkouts), a billing summary, customer contacts with email and phone, users, papers, tickets and admin activity. Pick the days you want. Days are Indian time and both end days are included. Passwords and sign-in codes are never included.
        </p>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Date range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRangeKey(option.key)}
              aria-pressed={rangeKey === option.key}
              className={`rounded-full border px-4 py-2 text-xs font-extrabold transition ${rangeKey === option.key ? "border-violet-600 bg-violet-600 text-white" : "border-violet-200 bg-white text-slate-700 hover:bg-violet-50"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {rangeKey === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-xs font-extrabold text-slate-600">From
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
            </label>
            <label className="text-xs font-extrabold text-slate-600">To
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} className="mt-1 block rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-slate-900" />
            </label>
          </div>
        ) : null}
        <p className="mt-3 text-xs font-bold text-slate-500" data-testid="export-range-summary">
          {range.from || range.to ? `Will export ${range.from || "the beginning"} to ${range.to || "today"}.` : "Will export everything, from the start."}
          {customInvalid ? " Choose a start day and an end day that is not before it." : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={primaryButton} disabled={busy || customInvalid} onClick={() => void exportBackup("xlsx")}>{busy ? "Preparing..." : "Export data (Excel)"}</button>
        </div>
      </section>

      <section className={panel}>
        <h2 className="text-2xl font-extrabold text-slate-950">Download backup</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          The complete JSON copy of the data, used to recover after a problem (see Restore below). It is always everything, never a date range, and it keeps database names. Passwords, sign-in tokens and sign-in codes are never included. Backups are manual downloads; for automatic copies use the database provider's own backups.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className={secondaryButton} disabled={busy} onClick={() => void exportBackup("json")}>Download backup (JSON)</button>
        </div>
        {history ? (
          <div className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${history.stale ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            <p className="font-extrabold">
              {history.last_export_at
                ? `Last backup: ${new Date(history.last_export_at).toLocaleString()} by ${history.last_export_by || "an admin"} (${history.last_export_age_days} day(s) ago)`
                : "No backup has been downloaded yet."}
            </p>
            {history.stale ? <p className="mt-1">Older than 7 days or never taken. Download a fresh backup.</p> : null}
            <p className="mt-1 text-xs">Downloads in the last year: {history.export_count_365d}. {history.note}</p>
            {history.recent.length > 0 ? (
              <ul className="mt-2 grid gap-1 text-xs">
                {history.recent.slice(0, 5).map((item) => (
                  <li key={item.id}>{item.at ? new Date(item.at).toLocaleString() : "?"} - {item.admin} - {item.action} ({item.outcome})</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={panel}>
        <h2 className="text-2xl font-extrabold text-slate-950">Restore from a JSON backup</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Added 2026-09-28 - previously export existed with no restore path at all. Deliberately conservative: this only
          re-inserts rows that are missing (matched by primary key) and never overwrites a row that already exists. Always
          preview first.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input ref={fileInputRef} type="file" accept="application/json" onChange={(event) => void onRestoreFileChosen(event)} className="text-xs font-bold text-slate-700" />
          {restoreFileName && <span className="text-xs font-bold text-slate-500">{restoreFileName}</span>}
        </div>
        {restoreFile ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button className={secondaryButton} disabled={restoreBusy} onClick={() => void runDryRun()}>
              {restoreBusy ? "Checking..." : "Preview (dry run)"}
            </button>
          </div>
        ) : null}
        {restorePreview ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs font-bold text-slate-700">
              <thead>
                <tr className="text-slate-500">
                  <th className="pb-2 pr-4">Table</th>
                  <th className="pb-2 pr-4">In backup</th>
                  <th className="pb-2 pr-4">Would/did insert</th>
                  <th className="pb-2 pr-4">Skipped rows</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(restorePreview).map(([table, summary]) => (
                  <tr key={table} className="border-t border-violet-200">
                    <td className="py-1.5 pr-4">{table}</td>
                    <td className="py-1.5 pr-4">{summary.in_backup}</td>
                    <td className="py-1.5 pr-4">{summary.would_insert || summary.inserted}</td>
                    <td className="py-1.5 pr-4">{summary.skipped_rows}{summary.note ? ` (${summary.note})` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <p className="text-sm font-extrabold text-rose-900">Apply this restore for real</p>
              <p className="mt-1 text-xs font-semibold text-rose-700">Type the confirmation phrase exactly to enable the button.</p>
              <input
                className="mt-2 w-full max-w-md rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-slate-900"
                placeholder={RESTORE_CONFIRMATION}
                value={restoreConfirmText}
                onChange={(event) => setRestoreConfirmText(event.target.value)}
              />
              <button
                type="button"
                disabled={restoreBusy || restoreConfirmText !== RESTORE_CONFIRMATION}
                onClick={() => void applyRestore()}
                className="mt-3 rounded-xl bg-rose-700 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {restoreBusy ? "Restoring..." : "Apply restore"}
              </button>
            </div>
          </div>
        ) : null}
        {restoreResult && <p className="mt-3 text-sm font-bold text-emerald-700">{restoreResult}</p>}
        {restoreError && <p className="mt-3 text-sm font-bold text-rose-700">{restoreError}</p>}
      </section>

      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">What the Excel export contains</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          These names are for business review. The JSON export keeps database table names because that is safer for restore.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {excelTabs.map((item) => <div key={item} className="rounded-xl border border-violet-200 bg-white p-4 font-bold text-slate-700">{item}</div>)}
        </div>
      </section>
    </AppShell>
  );
}


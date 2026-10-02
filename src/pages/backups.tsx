import { useRef, useState, type ChangeEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { getAdminAccessToken } from "@/lib/adminToken";
import { api } from "@/lib/apiClient";
import { errorNotice, notice, panel, primaryButton, secondaryButton } from "@/components/ui";

const RESTORE_CONFIRMATION = "RESTORE PAPERLY-NT DATABASE FROM BACKUP";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8003/api";

const excelTabs = [
  "Users",
  "Organizations",
  "Subscriptions",
  "Payments",
  "Generated Papers",
  "Template Usage",
  "Support Tickets",
  "Templates",
  "Admin Activity",
  "Security & Risk Events",
];

export default function BackupsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
            const token = getAdminAccessToken();
      const response = await fetch(`${API_BASE_URL}/admin/backups/export?format=${format}`, {
        method: "POST",
        credentials: "include",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `paperly-nt_backup_${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage(`${format.toUpperCase()} backup exported.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup route is not available yet.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="Backup & Recovery">
      {message ? <section className={notice}>{message}</section> : null}
      {error ? <section className={errorNotice}>Backup export failed. Backend route needed: POST /api/admin/backups/export. Details: {error}</section> : null}

      <section className={panel}>
        <h2 className="text-2xl font-extrabold text-slate-950">Backup control</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Excel is for human inspection with business-readable tabs. JSON is for restore-ready backups. Production should schedule this daily and store copies outside the database.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={primaryButton} disabled={busy} onClick={() => void exportBackup("xlsx")}>Export Excel backup</button>
          <button className={secondaryButton} disabled={busy} onClick={() => void exportBackup("json")}>Export JSON backup</button>
        </div>
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
        <h2 className="text-xl font-extrabold text-slate-950">Business-readable Excel tabs</h2>
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


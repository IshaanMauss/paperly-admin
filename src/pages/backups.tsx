import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { getAdminAccessToken } from "@/lib/adminToken";
import { errorNotice, notice, panel, primaryButton, secondaryButton } from "@/components/ui";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

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
      link.download = `paperly_backup_${new Date().toISOString().slice(0, 10)}.${format}`;
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
        <h2 className="text-2xl font-black text-slate-950">Backup control</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Excel is for human inspection with business-readable tabs. JSON is for restore-ready backups. Production should schedule this daily and store copies outside the database.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className={primaryButton} disabled={busy} onClick={() => void exportBackup("xlsx")}>Export Excel backup</button>
          <button className={secondaryButton} disabled={busy} onClick={() => void exportBackup("json")}>Export JSON backup</button>
        </div>
      </section>

      <section className={panel}>
        <h2 className="text-xl font-black text-slate-950">Business-readable Excel tabs</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          These names are for business review. The JSON export keeps database table names because that is safer for restore.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {excelTabs.map((item) => <div key={item} className="rounded-2xl border border-violet-100 bg-white p-4 font-bold text-slate-700">{item}</div>)}
        </div>
      </section>
    </AppShell>
  );
}


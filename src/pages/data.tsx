import { useEffect, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { api, saveBlob } from "@/lib/apiClient";
import type { DataDataset, DataEnvelope } from "@/lib/apiClient";
import { useAdminSession } from "@/lib/adminAuth";

// The Data page: everything Paperly-NT keeps for learning and review, in plain words. Anyone who can read users sees the list, the
// descriptions and a small anonymous preview. Downloads (JSON, CSV, one zip of everything, the data dictionary) are for the owner
// and are written to the audit log. People appear as anonymous labels unless "real account ids" is ticked.

function cell(v: unknown) {
  if (v == null || v === "") return "-";
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

function DatasetCard({ item, canDownload, realIds, from, to }: { item: DataDataset; canDownload: boolean; realIds: boolean; from: string; to: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<DataEnvelope | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function showPreview() {
    setError("");
    setBusy("preview");
    try {
      setPreview(await api.getDataPreview(item.key, 10));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the preview.");
    } finally {
      setBusy("");
    }
  }

  async function download(format: "json" | "csv") {
    setError("");
    setBusy(format);
    try {
      const { blob, filename } = await api.downloadDataset(item.key, { format, realIds, from: from || undefined, to: to || undefined });
      saveBlob(blob, filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy("");
    }
  }

  const columns = preview?.fields.map((f) => f.name) ?? [];
  return (
    <section className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h3 className="text-lg font-extrabold text-slate-950">{item.title}</h3>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.about}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-slate-950">{item.rows == null ? "-" : item.rows.toLocaleString("en-IN")}</p>
          <p className="text-xs font-bold uppercase text-slate-500">{item.set_up ? "rows" : "not set up yet"}</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-700"><b>Why it helps:</b> {item.why_it_helps}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700"><b>Privacy:</b> {item.privacy}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={secondaryButton} onClick={() => setOpen(!open)}>{open ? "Hide details" : "Key points and fields"}</button>
        <button type="button" className={secondaryButton} disabled={busy === "preview"} onClick={() => void showPreview()}>{busy === "preview" ? "Loading..." : "Preview 10 rows"}</button>
        {canDownload ? (
          <>
            <button type="button" className={primaryButton} disabled={!!busy} onClick={() => void download("json")}>{busy === "json" ? "Preparing..." : "Download JSON"}</button>
            <button type="button" className={secondaryButton} disabled={!!busy} onClick={() => void download("csv")}>{busy === "csv" ? "Preparing..." : "Download CSV"}</button>
          </>
        ) : null}
      </div>
      {error ? <p className={`${errorNotice} mt-3`}>{error}</p> : null}
      {open ? (
        <div className="mt-4 grid gap-4">
          <div>
            <h4 className="text-sm font-extrabold text-slate-900">Key points for learning</h4>
            <ul className="mt-1 list-disc pl-5 text-sm font-semibold text-slate-700">
              {item.key_points_for_learning.map((p) => <li key={p}>{p}</li>)}
            </ul>
          </div>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead><tr><th className={th}>Field</th><th className={th}>Kind</th><th className={th}>Meaning</th></tr></thead>
              <tbody>
                {item.fields.map((f) => (
                  <tr key={f.name}><td className={`${td} font-mono text-xs`}>{f.name}</td><td className={td}>{f.kind}</td><td className={td}>{f.meaning}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {preview ? (
        <div className="mt-4 overflow-x-auto">
          {preview.note ? <p className={notice}>{preview.note}</p> : null}
          <p className="mb-2 text-xs font-bold text-slate-500">{preview.people_shown_as}</p>
          {preview.rows.length ? (
            <table className={table}>
              <thead><tr>{columns.map((c) => <th key={c} className={th}>{c}</th>)}</tr></thead>
              <tbody>
                {preview.rows.map((r, i) => <tr key={i}>{columns.map((c) => <td key={c} className={`${td} text-xs`}>{cell(r[c])}</td>)}</tr>)}
              </tbody>
            </table>
          ) : <p className="text-sm font-semibold text-slate-500">No rows yet.</p>}
        </div>
      ) : null}
    </section>
  );
}

export default function DataPage() {
  const { hasPermission } = useAdminSession();
  const canDownload = hasPermission("accounts.write");
  const [items, setItems] = useState<DataDataset[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [realIds, setRealIds] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    let live = true;
    api.getDataDatasets().then((d) => live && setItems(d.datasets)).catch((e) => live && setError(e instanceof Error ? e.message : "Could not load the list.")).finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  async function run(kind: "zip" | "dictionary") {
    setError("");
    setBusy(kind);
    try {
      const file = kind === "zip" ? await api.downloadDataBundle({ realIds, from: from || undefined, to: to || undefined }) : await api.downloadDataDictionary();
      saveBlob(file.blob, file.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <AppShell title="Data">
      <section className={panel}>
        <h2 className="text-xl font-extrabold text-slate-950">How to use this page</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Each box below is one set of records. Read what it is, preview ten rows, and (owner only) download it as JSON or CSV. Every download carries its own plain description, so a person or a machine can read it without help. People appear as anonymous labels; the same person has the same label in every file. No student names, photos, handwriting, passwords or card details are kept.
        </p>
        {canDownload ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <label className="grid gap-1 text-xs font-bold text-slate-600">From (optional)<input type="date" className={input} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="grid gap-1 text-xs font-bold text-slate-600">To (optional)<input type="date" className={input} value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <label className="flex items-end gap-2 pb-2 text-xs font-bold text-slate-600">
              <input type="checkbox" checked={realIds} onChange={(e) => setRealIds(e.target.checked)} /> Use real account ids (handle with care)
            </label>
            <div className="flex items-end gap-2">
              <button type="button" className={primaryButton} disabled={!!busy} onClick={() => void run("zip")}>{busy === "zip" ? "Preparing..." : "Download everything (zip)"}</button>
            </div>
          </div>
        ) : <p className={`${notice} mt-4`}>Downloads are for the owner. You can read the descriptions and preview rows.</p>}
        <div className="mt-3">
          <button type="button" className={secondaryButton} disabled={!!busy} onClick={() => void run("dictionary")}>{busy === "dictionary" ? "Preparing..." : "Download the data dictionary"}</button>
        </div>
        {error ? <p className={`${errorNotice} mt-3`}>{error}</p> : null}
        {loading ? <p className="mt-3 text-sm font-bold text-slate-500">Loading...</p> : null}
      </section>
      {items.map((item) => <DatasetCard key={item.key} item={item} canDownload={canDownload} realIds={realIds} from={from} to={to} />)}
    </AppShell>
  );
}

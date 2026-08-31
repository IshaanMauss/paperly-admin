import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api, type MaintenanceStatus } from "@/lib/apiClient";

const DEFAULT_STATUS: MaintenanceStatus = {
  maintenance_active: false,
  title: "Paperly is under maintenance",
  message: "We are improving Paperly. Please come back shortly.",
  required_confirmation_to_enable: "PUT PAPERLY TEACHER MODULE IN MAINTENANCE",
  required_confirmation_to_disable: "RESTORE PAPERLY TEACHER MODULE",
};

export default function MaintenancePage() {
  const [status, setStatus] = useState<MaintenanceStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [targetActive, setTargetActive] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [title, setTitle] = useState(DEFAULT_STATUS.title);
  const [message, setMessage] = useState(DEFAULT_STATUS.message);
  const [reason, setReason] = useState("");
  const [updatedBy, setUpdatedBy] = useState("admin");

  function load() {
    setLoading(true);
    api
      .getMaintenanceStatus()
      .then((next) => {
        setStatus(next);
        setTitle(next.title || DEFAULT_STATUS.title);
        setMessage(next.message || DEFAULT_STATUS.message);
        setReason(next.reason || "");
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load maintenance state."))
      .finally(() => setLoading(false));
  }

  useEffect(() => onAdminDataRefresh(() => setRefreshTick((value) => value + 1)), []);
  useEffect(() => {
    load();
  }, [refreshTick]);

  const requiredText = useMemo(
    () => (targetActive ? status.required_confirmation_to_enable : status.required_confirmation_to_disable),
    [status.required_confirmation_to_disable, status.required_confirmation_to_enable, targetActive],
  );

  function openAction(nextActive: boolean) {
    setTargetActive(nextActive);
    setConfirmation("");
    setModalOpen(true);
  }

  function submit() {
    setSaving(true);
    api
      .updateMaintenanceStatus({ maintenance_active: targetActive, confirmation, title, message, reason, updated_by: updatedBy })
      .then((next) => {
        setStatus(next);
        setModalOpen(false);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not update maintenance state."))
      .finally(() => setSaving(false));
  }

  return (
    <AppShell title="Maintenance Control">
      <section className={panel}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Teacher module safety switch</p>
            <h2 className="mt-1 text-3xl font-black text-slate-950">Controlled maintenance mode</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
              This disables the teacher-facing product and replaces it with a maintenance screen. Use it before major schema, billing, or deployment changes.
            </p>
          </div>
          <button className="rounded-2xl border border-violet-200 bg-white px-5 py-3 text-sm font-black text-purple-800 shadow-soft transition-colors" onClick={load}>
            Refresh
          </button>
        </div>

        {error ? <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className={`rounded-[1.75rem] border p-6 shadow-sm ${status.maintenance_active ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Current status</p>
            <h3 className="mt-2 text-3xl font-black text-slate-950">{loading ? "Loading" : status.maintenance_active ? "Maintenance active" : "Teacher module live"}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">{status.message}</p>
            <div className="mt-5 grid gap-2 text-xs font-bold text-slate-500">
              <span>Source: {status.source || "unknown"}</span>
              <span>Updated: {status.updated_at ? new Date(status.updated_at).toLocaleString() : "Not recorded"}</span>
              <span>By: {status.updated_by || "Not recorded"}</span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-violet-100 bg-white p-6 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Message shown to teachers</p>
            <label className="mt-4 block text-xs font-black uppercase tracking-wider text-slate-500">
              Title
              <input className="mt-1 w-full rounded-xl border border-violet-100 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-violet-400" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="mt-3 block text-xs font-black uppercase tracking-wider text-slate-500">
              Message
              <textarea className="mt-1 min-h-24 w-full rounded-xl border border-violet-100 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-violet-400" value={message} onChange={(event) => setMessage(event.target.value)} />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Reason<input className="mt-1 w-full rounded-xl border border-violet-100 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-violet-400" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
              <label className="text-xs font-black uppercase tracking-wider text-slate-500">Updated by<input className="mt-1 w-full rounded-xl border border-violet-100 px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-900 outline-none focus:border-violet-400" value={updatedBy} onChange={(event) => setUpdatedBy(event.target.value)} /></label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-black text-amber-900 shadow-soft transition-colors disabled:opacity-50" disabled={status.maintenance_active} onClick={() => openAction(true)}>
            Put teacher module in maintenance
          </button>
          <button className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-800 shadow-soft transition-colors disabled:opacity-50" disabled={!status.maintenance_active} onClick={() => openAction(false)}>
            Restore teacher module
          </button>
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] border border-violet-100 bg-white p-6 shadow-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-700">Typed confirmation required</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950">{targetActive ? "Enable maintenance mode" : "Disable maintenance mode"}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Type this exact phrase before the platform state changes:</p>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white">{requiredText}</pre>
            <input className="mt-4 w-full rounded-2xl border border-violet-100 px-4 py-3 text-sm font-bold text-slate-900 outline-none focus:border-violet-400" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button className="rounded-2xl bg-purple-700 px-5 py-3 text-sm font-black text-white shadow-soft disabled:opacity-50" onClick={submit} disabled={saving || confirmation !== requiredText}>{saving ? "Saving" : "Confirm change"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}


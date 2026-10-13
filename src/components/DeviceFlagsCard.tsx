import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { panel } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import { api } from "@/lib/apiClient";
import type { DeviceFlags } from "@/lib/apiTypes";

function when(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Accounts whose device changes are paused and everyone who is banned, with one-click unpause / lift. */
export function DeviceFlagsCard() {
  const { hasPermission } = useAdminSession();
  const canAct = hasPermission("users.write");
  const [flags, setFlags] = useState<DeviceFlags | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const load = useCallback(() => {
    api.getDeviceFlags().then(setFlags).catch(() => setFlags({ paused: [], banned: [], signals: [] }));
  }, []);
  useEffect(load, [load]);

  async function act(key: string, run: () => Promise<unknown>, done: string) {
    if (reason.trim().length < 8) {
      setMessage({ text: "Write a reason of at least 8 characters first.", ok: false });
      return;
    }
    if (!window.confirm("Are you sure?")) return;
    setBusy(key);
    setMessage(null);
    try {
      await run();
      setMessage({ text: done, ok: true });
      setReason("");
      load();
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "That did not work.", ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (!flags || (flags.paused.length === 0 && flags.banned.length === 0 && flags.signals.length === 0 && !message)) return null;
  const who = (r: { name: string | null; email: string | null; teacher_id: string | null }) => r.name || r.email || r.teacher_id || "Unknown";
  return (
    <section className={panel} data-testid="device-flags">
      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-purple-700">Needs a decision</p>
      <h2 className="mt-1 text-xl font-extrabold text-slate-950">Paused, banned and flagged accounts</h2>
      {canAct ? (
        <input
          className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-bold text-slate-900"
          placeholder="Reason for the action you are about to take (required, logged)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      ) : null}
      {message ? <p className={`mt-3 rounded-xl px-3 py-2 text-sm font-bold ${message.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{message.text}</p> : null}

      {flags.paused.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Device changes paused ({flags.paused.length})</p>
          <div className="mt-2 space-y-2">
            {flags.paused.map((row) => (
              <div key={row.teacher_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm font-bold text-slate-800">
                <span className="min-w-0">
                  <Link href={`/user-360?teacher_id=${encodeURIComponent(row.teacher_id)}`} className="underline decoration-amber-300 underline-offset-2">{who(row)}</Link>
                  <span className="ml-2 text-xs text-slate-500">paused until {when(row.paused_until)}</span>
                </span>
                {canAct ? <button type="button" disabled={busy !== null} className="rounded-xl bg-purple-700 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50" onClick={() => void act(`p-${row.teacher_id}`, () => api.unpauseUserDevices(row.teacher_id, { reason: reason.trim() }), "Pause lifted.")}>{busy === `p-${row.teacher_id}` ? "Working..." : "Unpause"}</button> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {flags.signals.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Needs review ({flags.signals.length})</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">These are notes only. Nothing was blocked. Look, then dismiss, or open the user and ban.</p>
          <div className="mt-2 space-y-2">
            {flags.signals.map((row) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-sm font-bold text-slate-800">
                <span className="min-w-0">
                  <span>{row.label}</span>
                  {row.detail && typeof row.detail.accounts_24h === "number" ? <span className="ml-2 text-xs text-slate-500">{row.detail.accounts_24h} accounts in 24 hours</span> : null}
                  <span className="ml-2 text-xs text-slate-500">{when(row.created_at)}</span>
                  {row.teacher_id ? (
                    <Link href={`/user-360?teacher_id=${encodeURIComponent(row.teacher_id)}`} className="ml-2 text-xs underline decoration-sky-300 underline-offset-2">Open user{row.name || row.email ? ` (${row.name || row.email})` : ""}</Link>
                  ) : null}
                </span>
                {canAct ? <button type="button" disabled={busy !== null} className="rounded-xl bg-slate-700 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50" onClick={() => { setBusy(`s-${row.id}`); api.dismissReviewSignal(row.id).then(load).catch((err) => setMessage({ text: err instanceof Error ? err.message : "That did not work.", ok: false })).finally(() => setBusy(null)); }}>{busy === `s-${row.id}` ? "Working..." : "Dismiss"}</button> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      {flags.banned.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Banned ({flags.banned.length})</p>
          <div className="mt-2 space-y-2">
            {flags.banned.map((row, index) => (
              <div key={`${row.teacher_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-sm font-bold text-slate-800">
                <span className="min-w-0">
                  {row.account_exists && row.teacher_id ? <Link href={`/user-360?teacher_id=${encodeURIComponent(row.teacher_id)}`} className="underline decoration-rose-300 underline-offset-2">{who(row)}</Link> : <span>{who(row)} (account deleted)</span>}
                  <span className="ml-2 text-xs text-slate-500">{row.kinds.join(", ")} - by {row.banned_by || "-"} - {when(row.created_at)}</span>
                  {row.reason ? <span className="block text-xs font-semibold text-slate-500">{row.reason}</span> : null}
                </span>
                {canAct && row.teacher_id ? <button type="button" disabled={busy !== null} className="rounded-xl bg-purple-700 px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50" onClick={() => void act(`b-${row.teacher_id}-${index}`, () => api.unbanTeacherAccount(row.teacher_id as string, { reason: reason.trim() }), "Ban lifted.")}>{busy === `b-${row.teacher_id}-${index}` ? "Working..." : "Lift ban"}</button> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

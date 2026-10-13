import type { UserThreeSixty } from "@/lib/apiTypes";

function when(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

const EVENT_LABELS: Record<string, string> = {
  switch: "Switched device",
  refused: "Sign-in on another device refused",
  switch_limit: "Switch blocked (limit)",
  device_added: "Device added",
  backup_added: "Backup device added",
  backup_removed: "Backup device removed",
  backup_code_created: "Backup code created",
  admin_reset: "Devices reset by admin",
  admin_unpause: "Pause lifted by admin",
};

/** Read-only view of one user's device rule state: pause, devices, bans and recent device events. */
export function DeviceSafetyPanel({ data }: { data: UserThreeSixty }) {
  const state = data.device_state;
  const pausedUntil = state?.paused_until ? new Date(state.paused_until) : null;
  const paused = Boolean(pausedUntil && pausedUntil.getTime() > Date.now());
  const devices = (data.devices ?? []).filter((d) => d.active);
  const bans = data.bans ?? [];
  const events = data.device_events ?? [];
  return (
    <div className="rounded-xl border border-violet-200 bg-white p-5 shadow-soft" data-testid="device-safety">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">One ID, one device</p>
      <div className="mt-3 grid gap-2 text-sm font-bold text-slate-700 sm:grid-cols-3">
        <p className={`rounded-xl border px-3 py-2 ${paused ? "border-amber-300 bg-amber-50 text-amber-900" : "border-violet-100 bg-violet-50/40"}`}>
          {paused ? `Device changes PAUSED until ${when(state?.paused_until)}` : "Device changes open"}
        </p>
        <p className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2">Changes in 24 hours: {state ? `${Math.min(state.switches_24h, state.switch_limit)} of ${state.switch_limit}` : "-"}</p>
        <p className={`rounded-xl border px-3 py-2 ${bans.some((b) => b.active) ? "border-rose-300 bg-rose-50 text-rose-900" : "border-violet-100 bg-violet-50/40"}`}>
          {bans.some((b) => b.active) ? `BANNED: ${bans.filter((b) => b.active).map((b) => b.kind).join(", ")}` : "No active ban"}
        </p>
      </div>

      <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Registered devices</p>
      {devices.length === 0 ? (
        <p className="mt-1 text-xs font-semibold text-slate-400">None. The next device they sign in on becomes the main device.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {devices.map((d, index) => (
            <div key={index} className="rounded-xl border border-violet-50 bg-violet-50/40 px-3 py-2 text-xs font-bold text-slate-600">
              <p><span className="capitalize">{d.role}</span> - {d.label || "Device"} - last used {when(d.last_used_at)}</p>
              <p className="mt-1 text-slate-400">{d.ip_address || "Unknown IP"} - added {when(d.added_at)}{typeof d.accounts_on_device === "number" ? ` - accounts that have used this device: ${d.accounts_on_device} of 2` : ""}</p>
            </div>
          ))}
        </div>
      )}

      {bans.length > 0 ? (
        <>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Bans</p>
          <div className="mt-2 space-y-2">
            {bans.map((b, index) => (
              <div key={index} className="rounded-xl border border-violet-50 bg-violet-50/40 px-3 py-2 text-xs font-bold text-slate-600">
                <p>{b.kind} - {b.active ? "active" : "lifted"} - by {b.banned_by || "-"} on {when(b.created_at)}</p>
                {b.reason ? <p className="mt-1 text-slate-400">{b.reason}</p> : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="mt-4 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Recent device events</p>
      {events.length === 0 ? (
        <p className="mt-1 text-xs font-semibold text-slate-400">Nothing yet.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs font-bold text-slate-600">
          {events.slice(0, 15).map((e, index) => (
            <li key={index} className="flex flex-wrap justify-between gap-x-3">
              <span>{EVENT_LABELS[e.event] || e.event}{e.label ? ` (${e.label})` : ""}{e.method ? ` via ${e.method}` : ""}</span>
              <span className="text-slate-400">{when(e.at)}{e.ip_address ? ` - ${e.ip_address}` : ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

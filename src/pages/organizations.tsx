import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel, primaryButton, secondaryButton, input } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import { OrganizationRequestRow, OrganizationRow, OrganizationsMeta, api } from "@/lib/apiClient";

// Two doors feed a custom/institute workspace request in: the public
// pricing page (a brand-new visitor with no account) and the "inside door"
// on an existing teacher's own /custom-plan page (their school wants to
// upgrade them). Both land here as one Requests inbox. Approving a request
// creates the live Organization and hands you into the theme/feature
// editor below it; nothing about an organization is edited until a request
// for it exists and is approved - there's no "search for an org that may
// not exist yet" dead end anymore.

type Tab = "requests" | "organizations";

function swatch(color: string) {
  return <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: color }} />;
}

const REQUEST_STATUS_THEME: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  approved: "border-sky-200 bg-sky-50 text-sky-800",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-800",
  rejected: "border-rose-200 bg-rose-50 text-rose-800",
};

const SOURCE_LABEL: Record<string, string> = {
  new_visitor: "New visitor (pricing page)",
  existing_teacher: "Existing teacher (inside app)",
};

function RequestCard({ row, adminEmail, onChanged }: { row: OrganizationRequestRow; adminEmail: string | null; onChanged: (row: OrganizationRequestRow) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [copied, setCopied] = useState(false);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.approveOrganizationRequest(row.id, { decided_by: adminEmail || undefined });
      onChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve this request.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.rejectOrganizationRequest(row.id, { decided_by: adminEmail || undefined, reason: rejectReason || undefined });
      onChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reject this request.");
    } finally {
      setBusy(false);
    }
  }

  async function markDelivered() {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.deliverOrganizationRequest(row.id);
      onChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this request.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!row.activation_link) return;
    try {
      await navigator.clipboard.writeText(row.activation_link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (permissions, non-secure context) - the
      // link is still shown as selectable text below, so this is a soft fail.
    }
  }

  return (
    <div className={`${panel} space-y-3 p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{row.institute_name}</p>
          <p className="text-xs text-slate-500">{SOURCE_LABEL[row.source] || row.source}{row.teacher_id ? ` · teacher_id: ${row.teacher_id}` : ""}</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${REQUEST_STATUS_THEME[row.status] || "border-slate-200 bg-slate-50 text-slate-700"}`}>
          {row.status}
        </span>
      </div>

      <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <p><span className="font-bold text-slate-800">Contact:</span> {row.contact_name || "—"}</p>
        <p><span className="font-bold text-slate-800">Email:</span> {row.contact_email || "—"}</p>
        <p><span className="font-bold text-slate-800">Phone:</span> {row.contact_phone || "—"}</p>
        <p><span className="font-bold text-slate-800">Estimated:</span> {row.estimated_monthly_rupees ? `₹${row.estimated_monthly_rupees.toLocaleString("en-IN")}/mo` : "—"}</p>
      </div>

      {row.requested_features.length ? (
        <div className="flex flex-wrap gap-1.5">
          {row.requested_features.map((f) => (
            <span key={f} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{f}</span>
          ))}
        </div>
      ) : null}

      {row.notes ? <p className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">{row.notes}</p> : null}

      {row.rejection_reason ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 p-3 text-xs font-semibold text-rose-800">Rejected: {row.rejection_reason}</p>
      ) : null}

      {row.activation_link ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-sky-700">Activation link — send this to the customer</p>
          <p className="mt-1 break-all font-mono text-xs text-sky-900">{row.activation_link}</p>
          <div className="mt-2 flex items-center gap-2">
            <button type="button" className={secondaryButton} onClick={copyLink}>{copied ? "Copied" : "Copy link"}</button>
            {row.status === "approved" ? (
              <button type="button" className={primaryButton} disabled={busy} onClick={markDelivered}>Mark delivered</button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}

      {row.status === "pending" ? (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          {showReject ? (
            <div className="flex flex-wrap items-center gap-2">
              <input className={`${input} max-w-sm`} placeholder="Reason (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
              <button type="button" className={secondaryButton} disabled={busy} onClick={reject}>Confirm reject</button>
              <button type="button" className="text-xs font-bold text-slate-500" onClick={() => setShowReject(false)}>Cancel</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButton} disabled={busy} onClick={approve}>
                {busy ? "Approving..." : "Approve → create organization"}
              </button>
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => setShowReject(true)}>Reject</button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function OrgEditor({ org, meta, onSaved }: { org: OrganizationRow; meta: OrganizationsMeta; onSaved: (row: OrganizationRow) => void }) {
  const [mode, setMode] = useState(org.theme.mode);
  const [background, setBackground] = useState(org.theme.background);
  const [primary, setPrimary] = useState(org.theme.primary);
  const [accent, setAccent] = useState(org.theme.accent);
  const [flags, setFlags] = useState<Record<string, boolean>>(org.feature_flags);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const presetKeys = useMemo(() => Object.keys(meta.theme_presets), [meta.theme_presets]);
  const isDirty =
    mode !== org.theme.mode ||
    background !== org.theme.background ||
    primary !== org.theme.primary ||
    accent !== org.theme.accent ||
    JSON.stringify(flags) !== JSON.stringify(org.feature_flags);

  function applyPreset(key: string) {
    const preset = meta.theme_presets[key];
    if (!preset) return;
    setMode(key);
    setBackground(preset.background);
    setPrimary(preset.primary);
    setAccent(preset.accent);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateOrganization(org.id, {
        branding: { mode, background, primary, accent },
        feature_flags: flags,
      });
      onSaved(updated);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this organization.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`${panel} space-y-5 p-5`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{org.name}</p>
          <p className="text-xs text-slate-500">{org.organization_key} &middot; {org.organization_type}</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          {swatch(background)}
          {swatch(primary)}
          {swatch(accent)}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Theme</p>
        <div className="flex flex-wrap gap-2">
          {presetKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize transition ${
                mode === key ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {key === "regular" ? "Regular (yellow)" : key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              mode === "custom" ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            Custom
          </button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            Background
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={background} onChange={(e) => { setBackground(e.target.value); setMode("custom"); }} className="h-9 w-9 rounded border border-slate-200" />
              <input className={input} value={background} onChange={(e) => { setBackground(e.target.value); setMode("custom"); }} />
            </div>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Primary
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={primary} onChange={(e) => { setPrimary(e.target.value); setMode("custom"); }} className="h-9 w-9 rounded border border-slate-200" />
              <input className={input} value={primary} onChange={(e) => { setPrimary(e.target.value); setMode("custom"); }} />
            </div>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Accent
            <div className="mt-1 flex items-center gap-2">
              <input type="color" value={accent} onChange={(e) => { setAccent(e.target.value); setMode("custom"); }} className="h-9 w-9 rounded border border-slate-200" />
              <input className={input} value={accent} onChange={(e) => { setAccent(e.target.value); setMode("custom"); }} />
            </div>
          </label>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Features</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(meta.feature_flags).map(([key, info]) => (
            <label key={key} className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={flags[key] ?? true}
                onChange={(e) => setFlags((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              <span>
                <span className="block font-bold text-slate-800">{info.label}</span>
                <span className="block text-slate-500">{info.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
      <div className="flex items-center gap-3">
        <button type="button" className={primaryButton} disabled={!isDirty || saving} onClick={save}>
          {saving ? "Saving..." : "Save changes"}
        </button>
        {!isDirty && savedAt ? <span className="text-xs font-semibold text-emerald-700">Saved</span> : null}
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const { admin } = useAdminSession();
  const [tab, setTab] = useState<Tab>("requests");

  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("pending");
  const [requests, setRequests] = useState<OrganizationRequestRow[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);

  const [meta, setMeta] = useState<OrganizationsMeta | null>(null);
  const [items, setItems] = useState<OrganizationRow[]>([]);
  const [search, setSearch] = useState("");
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [orgsError, setOrgsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getOrganizationsMeta().then((m) => { if (!cancelled) setMeta(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (tab !== "requests") return;
    let cancelled = false;
    setRequestsLoading(true);
    api
      .listOrganizationRequests({ status: requestStatusFilter === "all" ? undefined : requestStatusFilter, limit: 100 })
      .then((res) => { if (!cancelled) { setRequests(res.items); setRequestsError(null); } })
      .catch((err) => { if (!cancelled) setRequestsError(err instanceof Error ? err.message : "Could not load requests."); })
      .finally(() => { if (!cancelled) setRequestsLoading(false); });
    return () => { cancelled = true; };
  }, [tab, requestStatusFilter]);

  useEffect(() => {
    if (tab !== "organizations") return;
    let cancelled = false;
    setOrgsLoading(true);
    api
      .listOrganizations({ search: search || undefined, limit: 50 })
      .then((res) => { if (!cancelled) { setItems(res.items); setOrgsError(null); } })
      .catch((err) => { if (!cancelled) setOrgsError(err instanceof Error ? err.message : "Could not load organizations."); })
      .finally(() => { if (!cancelled) setOrgsLoading(false); });
    return () => { cancelled = true; };
  }, [tab, search]);

  function handleRequestChanged(updated: OrganizationRequestRow) {
    setRequests((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  function handleOrgSaved(updated: OrganizationRow) {
    setItems((prev) => {
      const exists = prev.some((row) => row.id === updated.id);
      return exists ? prev.map((row) => (row.id === updated.id ? updated : row)) : [updated, ...prev];
    });
  }

  return (
    <AppShell title="Organizations">
      <div className="space-y-5">
        <div className={`${panel} p-5`}>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">White-label</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">Organizations</h1>
          <p className="mt-1 text-sm text-slate-600">
            Custom/institute workspaces start as a request — from the public pricing page or from an existing
            teacher inside the app — and become a themed, feature-gated organization once you approve it here.
          </p>
          <div className="mt-4 inline-flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setTab("requests")} className={`rounded-xl px-4 py-2 text-sm font-black transition ${tab === "requests" ? "bg-white text-violet-800 shadow-soft" : "text-slate-500"}`}>Requests</button>
            <button type="button" onClick={() => setTab("organizations")} className={`rounded-xl px-4 py-2 text-sm font-black transition ${tab === "organizations" ? "bg-white text-violet-800 shadow-soft" : "text-slate-500"}`}>Organizations</button>
          </div>
        </div>

        {tab === "requests" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {["pending", "approved", "delivered", "rejected", "all"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRequestStatusFilter(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-black capitalize transition ${
                    requestStatusFilter === s ? "border-violet-400 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {requestsError ? <div className={`${panel} p-4 text-sm font-semibold text-rose-700`}>{requestsError}</div> : null}
            {requestsLoading ? <div className={`${panel} p-6 text-sm text-slate-500`}>Loading requests...</div> : null}
            {!requestsLoading && !requests.length && !requestsError ? (
              <div className={`${panel} p-6 text-sm text-slate-500`}>
                No {requestStatusFilter === "all" ? "" : requestStatusFilter} requests right now. New submissions from the
                pricing page or from a teacher&apos;s custom-plan request will show up here.
              </div>
            ) : null}

            {requests.map((row) => (
              <RequestCard key={row.id} row={row} adminEmail={admin?.email || null} onChanged={handleRequestChanged} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`${panel} p-4`}>
              <input
                className={`${input} max-w-sm`}
                placeholder="Search by name or key..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {orgsError ? <div className={`${panel} p-4 text-sm font-semibold text-rose-700`}>{orgsError}</div> : null}
            {orgsLoading ? <div className={`${panel} p-6 text-sm text-slate-500`}>Loading organizations...</div> : null}
            {!orgsLoading && !items.length && !orgsError ? (
              <div className={`${panel} p-6 text-sm text-slate-500`}>
                No organizations yet. Approve a request in the Requests tab to create the first one.
              </div>
            ) : null}

            {meta && items.map((org) => <OrgEditor key={org.id} org={org} meta={meta} onSaved={handleOrgSaved} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { panel, primaryButton, secondaryButton, input } from "@/components/ui";
import { OrganizationRow, OrganizationsMeta, api } from "@/lib/apiClient";

// Per-institute white-label control: swap the theme colors (logo mark and
// layout never change) and turn individual features on/off for a single
// custom-plan organization. Edits here take effect the next time that
// organization's teacher module loads.

function swatch(color: string) {
  return <span className="inline-block h-4 w-4 rounded-full border border-slate-300" style={{ backgroundColor: color }} />;
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
  const [meta, setMeta] = useState<OrganizationsMeta | null>(null);
  const [items, setItems] = useState<OrganizationRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getOrganizationsMeta().then((m) => { if (!cancelled) setMeta(m); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listOrganizations({ search: search || undefined, limit: 50 })
      .then((res) => { if (!cancelled) { setItems(res.items); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load organizations."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [search]);

  function handleSaved(updated: OrganizationRow) {
    setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }

  return (
    <AppShell title="Organizations">
      <div className="space-y-5">
        <div className={`${panel} p-5`}>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">White-label</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">Organizations &amp; custom branding</h1>
          <p className="mt-1 text-sm text-slate-600">
            Give a custom-plan institute its own theme color and feature set. The Paperly logo mark and layout stay the
            same everywhere - only colors and which features are switched on change, and it applies live to that
            organization&apos;s teacher module.
          </p>
          <input
            className={`${input} mt-4 max-w-sm`}
            placeholder="Search by name or key..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? <div className={`${panel} p-4 text-sm font-semibold text-rose-700`}>{error}</div> : null}
        {loading ? <div className={`${panel} p-6 text-sm text-slate-500`}>Loading organizations...</div> : null}
        {!loading && !items.length && !error ? (
          <div className={`${panel} p-6 text-sm text-slate-500`}>
            No organizations found yet. Institute/custom accounts appear here once they sign up or are created for a
            customer.
          </div>
        ) : null}

        {meta && items.map((org) => <OrgEditor key={org.id} org={org} meta={meta} onSaved={handleSaved} />)}
      </div>
    </AppShell>
  );
}

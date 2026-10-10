import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, notice, panel, primaryButton, secondaryButton } from "@/components/ui";
import { onAdminDataRefresh } from "@/lib/adminRefresh";
import { api } from "@/lib/apiClient";
import type {
  PlanConfigChange,
  PlanConfigPreview,
  PlanConfigSparse,
  PlanConfigState,
  PlanField,
  PlanFieldValue,
  PlanRowValue,
  PlanValues,
} from "@/lib/apiTypes";

// Plans & Features (2026-10-02). Every feature, limit, price and customer-facing word lives here.
// You edit a DRAFT; nothing changes for customers until you publish. People who already paid keep
// what they bought until their plan renews. See backend app/services/plan_config_service.py.

const PUBLISH_PHRASE = "PUBLISH PLAN CHANGES";
const PRICE_PHRASE = "CHANGE PRICES";

// One fixed display rate, same as the backend (plan_config_registry.USD_INR_RATE) and the customer site.
const USD_INR_RATE = 88;
function usd(rupees: number) {
  const dollars = Math.round((rupees / USD_INR_RATE) * 100) / 100;
  return `$${dollars.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function sameValue(a: PlanFieldValue | undefined, b: PlanFieldValue | undefined) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function show(value: PlanFieldValue | undefined, field?: PlanField): string {
  if (value === null || value === undefined) return field?.kind === "int" ? "No limit" : "(empty)";
  if (typeof value === "boolean") return value ? "On" : "Off";
  if (Array.isArray(value)) return value.length ? `${value.length} item${value.length === 1 ? "" : "s"}` : "(none)";
  if (field?.key === "price_rupees" && typeof value === "number") return `${usd(value)} (Rs ${value}, GST included)`;
  if (field?.key === "standing_offer_percent") return `${value}% off`;
  return String(value);
}

function Pill({ tone, children }: { tone: "green" | "amber" | "slate" | "violet"; children: React.ReactNode }) {
  const tones = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  } as const;
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${tones[tone]}`}>{children}</span>;
}

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-purple-600" : "bg-slate-300"} ${disabled ? "opacity-50" : ""}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function RowsEditor({ rows, onChange }: { rows: PlanRowValue[]; onChange: (rows: PlanRowValue[]) => void }) {
  function patch(index: number, change: Partial<PlanRowValue>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }
  return (
    <div className="grid gap-2">
      {rows.map((row, index) => (
        <div key={index} className="grid gap-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-[10rem_1fr_auto]">
          <input className={input} value={row.label} onChange={(e) => patch(index, { label: e.target.value })} placeholder="Label" maxLength={40} />
          <input className={input} value={row.value} onChange={(e) => patch(index, { value: e.target.value })} placeholder="What the plan gives" maxLength={220} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <Switch checked={row.included} onChange={(next) => patch(index, { included: next })} /> Included
            </label>
            <button type="button" className="text-xs font-bold text-rose-700 underline" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove</button>
          </div>
          <input className={`${input} sm:col-span-3`} value={row.info || ""} onChange={(e) => patch(index, { info: e.target.value })} placeholder="Optional help note (shown when the little 'i' is opened)" maxLength={400} />
        </div>
      ))}
      <div>
        <button type="button" className={secondaryButton} onClick={() => onChange([...rows, { label: "", value: "", included: true }])}>Add a row</button>
      </div>
    </div>
  );
}

function FieldEditor({ field, value, onChange }: { field: PlanField; value: PlanFieldValue | undefined; onChange: (next: PlanFieldValue) => void }) {
  if (!field.editable) return <p className="text-sm font-bold text-slate-500">{show(value, field)} <span className="font-semibold">(kept in code)</span></p>;
  if (field.kind === "bool") {
    return (
      <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
        <Switch checked={value === true} onChange={onChange} /> {value === true ? "On" : "Off"}
      </label>
    );
  }
  if (field.kind === "int") {
    const unlimited = value === null || value === undefined;
    return (
      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${input} max-w-[10rem]`}
          type="number"
          min={field.min}
          max={field.max}
          disabled={unlimited}
          value={unlimited ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? (field.nullable ? null : Number(field.min)) : Number(e.target.value))}
        />
        {field.unit ? <span className="text-xs font-semibold text-slate-500">{field.unit}</span> : null}
        {field.nullable ? (
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={unlimited} onChange={(e) => onChange(e.target.checked ? null : Number(field.min ?? 1))} /> No limit
          </label>
        ) : null}
      </div>
    );
  }
  if (field.kind === "enum") {
    return (
      <select className={`${input} max-w-[12rem]`} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
        {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }
  if (field.kind === "text") {
    return <input className={input} value={String(value ?? "")} maxLength={field.max_len} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.kind === "lines") {
    const lines = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div>
        <textarea className={`${input} min-h-[7rem]`} value={lines.join("\n")} onChange={(e) => onChange(e.target.value.split("\n").filter((line, i, all) => line.trim() !== "" || i < all.length - 1))} placeholder="One line per item" />
        <p className="mt-1 text-[11px] font-semibold text-slate-500">One line per item, up to {field.max_items} lines of {field.max_len} characters.</p>
      </div>
    );
  }
  return <RowsEditor rows={Array.isArray(value) ? (value as PlanRowValue[]) : []} onChange={onChange} />;
}

function FieldRow({ field, value, live, def, onChange, onReset }: { field: PlanField; value: PlanFieldValue | undefined; live: PlanFieldValue | undefined; def: PlanFieldValue | undefined; onChange: (next: PlanFieldValue) => void; onReset: () => void }) {
  const changed = !sameValue(value, live);
  return (
    <div className={`grid gap-2 border-b border-violet-100 py-4 lg:grid-cols-[18rem_1fr] ${changed ? "bg-amber-50/50" : ""}`}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-extrabold text-slate-950">{field.label}</p>
          {!field.enforced ? <Pill tone="amber">Not enforced yet</Pill> : null}
          {field.snapshot && field.enforced ? <Pill tone="violet">Subscribers keep theirs until renewal</Pill> : null}
          {changed ? <Pill tone="amber">Changed</Pill> : null}
        </div>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{field.help}</p>
      </div>
      <div>
        <FieldEditor field={field} value={value} onChange={onChange} />
        <p className="mt-2 text-[11px] font-semibold text-slate-500">
          Live now: <span className="font-extrabold text-slate-700">{show(live, field)}</span>
          {!sameValue(live, def) ? <> · Built-in default: {show(def, field)}</> : null}
          {changed ? <button type="button" className="ml-3 font-extrabold text-purple-700 underline" onClick={onReset}>Undo</button> : null}
        </p>
      </div>
    </div>
  );
}

function PlanCardPreview({ values }: { values: PlanValues }) {
  const rows = (values.rows as PlanRowValue[]) || [];
  const price = values.price_rupees as number | undefined;
  const offerPercent = Number(values.standing_offer_percent || 0);
  const offerPrice = price ? Math.round((price * (100 - offerPercent)) / 100) : 0;
  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">How it reads to customers</p>
      <p className="mt-2 text-xl font-extrabold text-slate-950">{String(values.label || "")}</p>
      <p className="text-sm font-semibold text-slate-600">{String(values.tagline || "")}</p>
      <p className="mt-2 text-2xl font-extrabold text-purple-700">{price ? (<>{offerPercent > 0 ? <span className="mr-2 text-base font-bold text-slate-400 line-through">{usd(price)}</span> : null}{usd(offerPrice)}</>) : "Free"} <span className="text-xs font-bold text-slate-500">{String(values.cadence || "")}{price ? ` · Rs ${offerPrice.toLocaleString("en-IN")} charged, GST included` : ""}</span></p>
      <ul className="mt-3 grid gap-1.5">
        {rows.map((row, i) => (
          <li key={i} className={`text-sm ${row.included ? "text-slate-800" : "text-slate-400"}`}>
            <span className="font-extrabold">{row.included ? "✓" : "–"} {row.label}:</span> {row.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChangeList({ changes }: { changes: PlanConfigChange[] }) {
  if (!changes.length) return <p className="text-sm font-semibold text-slate-500">No changes against what is live.</p>;
  return (
    <div className="grid gap-2">
      {changes.map((change, i) => (
        <div key={i} className="rounded-lg border border-violet-100 bg-white p-3 text-sm">
          <p className="font-extrabold text-slate-950">{change.plan_label}: {change.label}</p>
          <p className="mt-0.5 font-semibold text-slate-600">
            <span className="line-through">{Array.isArray(change.before) ? `${change.before.length} items` : show(change.before)}</span> → <span className="font-extrabold text-slate-950">{Array.isArray(change.after) ? `${change.after.length} items` : show(change.after)}</span>
          </p>
          <p className="mt-1 text-[11px] font-bold text-slate-500">
            {change.grandfathered ? "Existing subscribers keep their current value until they renew." : change.key === "price_rupees" ? "Applies to new purchases and renewals. Nobody is charged extra before they renew." : "Words only: shown straight away."}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function PlansPage() {
  const [state, setState] = useState<PlanConfigState | null>(null);
  const [values, setValues] = useState<Record<string, PlanValues>>({});
  const [activePlan, setActivePlan] = useState("teacher_monthly");
  const [preview, setPreview] = useState<PlanConfigPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<number | null>(null);
  const [phrase, setPhrase] = useState("");
  const [pricePhrase, setPricePhrase] = useState("");
  const [tick, setTick] = useState(0);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getPlanConfig()
      .then((res) => {
        setState(res);
        setValues(JSON.parse(JSON.stringify(res.working_plans)));
        if (res.draft) void api.previewPlanConfig().then(setPreview).catch(() => setPreview(null));
        else setPreview(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load the plans."))
      .finally(() => setLoading(false));
  }
  useEffect(() => onAdminDataRefresh(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  const fields = useMemo(() => state?.schema.fields || [], [state]);
  const livePlans = useMemo(() => state?.published.plans || {}, [state]);
  const defaults = useMemo(() => state?.defaults || {}, [state]);

  // What differs from the built-in defaults: the only thing the server stores.
  const sparse = useMemo<PlanConfigSparse>(() => {
    const plans: Record<string, PlanValues> = {};
    for (const code of state?.schema.plan_codes || []) {
      const diff: PlanValues = {};
      for (const field of fields) {
        if (!field.editable || !field.plans.includes(code)) continue;
        const next = values[code]?.[field.key];
        if (next !== undefined && !sameValue(next, defaults[code]?.[field.key])) diff[field.key] = next as PlanFieldValue;
      }
      if (Object.keys(diff).length) plans[code] = diff;
    }
    return { plans };
  }, [values, fields, defaults, state]);

  // Unsaved edits: differs from what the server has (the saved draft, or live if there is no draft).
  const savedPlans = useMemo(() => state?.working_plans || {}, [state]);
  const dirtyUnsaved = useMemo(() => {
    return (state?.schema.plan_codes || []).some((code) => fields.some((field) => field.plans.includes(code) && !sameValue(values[code]?.[field.key], savedPlans[code]?.[field.key])));
  }, [values, fields, savedPlans, state]);

  function setField(code: string, key: string, next: PlanFieldValue) {
    setValues((current) => ({ ...current, [code]: { ...current[code], [key]: next } }));
    setMessage(null);
  }

  async function saveDraft(): Promise<PlanConfigPreview | null> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.savePlanConfigDraft(sparse);
      setPreview(result);
      setMessage("Draft saved. Nothing has changed for customers yet.");
      const fresh = await api.getPlanConfig();
      setState(fresh);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the draft.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** One button from edit to apply: saves the edits, then opens the review-and-publish box. */
  async function applyChanges() {
    let current: PlanConfigPreview | null = preview;
    if (dirtyUnsaved) current = await saveDraft();
    if (!current || current.changes.length === 0) {
      if (current) setMessage("Nothing differs from what is live, so there is nothing to apply.");
      return;
    }
    setShowPublish(true);
  }

  async function discard() {
    setBusy(true);
    setError(null);
    try {
      await api.discardPlanConfigDraft();
      setMessage("Draft discarded. The editor now shows what is live.");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not discard the draft.");
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.publishPlanConfig(phrase, pricePhrase);
      setShowPublish(false);
      setPhrase("");
      setPricePhrase("");
      setMessage(`Published as version ${result.version}. ${result.subscribers_locked_in} current subscriber${result.subscribers_locked_in === 1 ? "" : "s"} locked in at what they bought.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  }

  async function rollback() {
    if (rollbackTarget === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.rollbackPlanConfig(rollbackTarget, phrase, pricePhrase);
      setRollbackTarget(null);
      setPhrase("");
      setPricePhrase("");
      setMessage(`Rolled back. Live version is now ${result.version}.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not roll back.");
    } finally {
      setBusy(false);
    }
  }

  const groups = state?.schema.groups || [];
  const planCodes = useMemo(() => state?.schema.plan_codes || [], [state]);
  const subscribers = state?.subscribers || {};
  const draftSaved = Boolean(state?.draft);
  const unsavedCount = useMemo(() => {
    let n = 0;
    for (const code of planCodes) for (const field of fields) if (field.plans.includes(code) && !sameValue(values[code]?.[field.key], savedPlans[code]?.[field.key])) n += 1;
    return n;
  }, [values, fields, savedPlans, planCodes]);
  const changedVsLive = (code: string, groupKey: string) => fields.filter((f) => f.group === groupKey && f.plans.includes(code) && !sameValue(values[code]?.[f.key], livePlans[code]?.[f.key])).length;
  const priceChanged = Boolean(preview?.price_changed);
  const hasChanges = (preview?.changes.length || 0) > 0;

  return (
    <AppShell title="Plans & Features">
      {error ? <p className={errorNotice}>{error}</p> : null}
      {message ? <p className={notice}>{message}</p> : null}
      {loading && !state ? <p className="text-sm font-semibold text-slate-500">Loading plans…</p> : null}
      {state ? (
        <>
          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-950">
                  Live: {state.published.version ? `version ${state.published.version}` : "built-in defaults (nothing published yet)"}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  Customers see the live version. Your edits stay in a draft until you publish. People who already paid keep what they bought until their plan renews, with no extra charge before then.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {planCodes.map((code) => (
                  <button key={code} type="button" onClick={() => setActivePlan(code)} className={`rounded-lg border px-3 py-2 text-sm font-extrabold ${activePlan === code ? "border-purple-600 bg-purple-600 text-white" : "border-violet-200 bg-white text-slate-800 hover:bg-purple-50"}`}>
                    {String(livePlans[code]?.label || code)}
                    {subscribers[code] ? <span className={`ml-2 text-[11px] ${activePlan === code ? "text-white/80" : "text-slate-500"}`}>{subscribers[code]} active</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={panel}>
            <h2 className="text-base font-extrabold text-slate-950">At a glance</h2>
            <p className="mb-3 text-xs font-semibold text-slate-500">What each plan gives right now (live). Click a row's plan name to edit that plan below.</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3">What</th>
                    {planCodes.map((code) => (
                      <th key={code} className="pb-2 pr-3">
                        <button type="button" className={`underline ${activePlan === code ? "text-purple-700" : ""}`} onClick={() => setActivePlan(code)}>{String(livePlans[code]?.label || code)}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fields.filter((f) => f.editable && f.enforced && ["price", "papers", "full_portion", "ai", "answers", "tools"].includes(f.group)).map((f) => (
                    <tr key={f.key} className="border-t border-violet-100">
                      <td className="py-1.5 pr-3 font-bold text-slate-700">{f.label}</td>
                      {planCodes.map((code) => (
                        <td key={code} className={`py-1.5 pr-3 font-semibold ${f.plans.includes(code) ? "text-slate-900" : "text-slate-300"}`}>
                          {f.plans.includes(code) ? show(livePlans[code]?.[f.key], f) : "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
            <div>
              {groups.map((group) => {
                const groupFields = fields.filter((field) => field.group === group.key && field.plans.includes(activePlan));
                if (!groupFields.length) return null;
                const changedHere = changedVsLive(activePlan, group.key);
                const summary = groupFields.filter((f) => f.kind === "int" || f.kind === "bool").slice(0, 4).map((f) => `${f.label}: ${show(values[activePlan]?.[f.key], f)}`).join(" · ");
                return (
                  <details key={`${activePlan}-${group.key}-${changedHere > 0}`} className={`${panel} group`} open={changedHere > 0 || group.key === "papers"}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="text-base font-extrabold text-slate-950">{group.label}</span>
                        {changedHere > 0 ? <span className="ml-2"><Pill tone="amber">{changedHere} changed</Pill></span> : null}
                        <span className="mt-0.5 block text-xs font-semibold text-slate-500">{summary || group.help}</span>
                      </span>
                      <span className="text-xs font-extrabold text-purple-700 group-open:hidden">Open</span>
                      <span className="hidden text-xs font-extrabold text-purple-700 group-open:inline">Close</span>
                    </summary>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{group.help}</p>
                    <div className="mt-2">
                      {groupFields.map((field) => (
                        <FieldRow
                          key={field.key}
                          field={field}
                          value={values[activePlan]?.[field.key]}
                          live={livePlans[activePlan]?.[field.key]}
                          def={defaults[activePlan]?.[field.key]}
                          onChange={(next) => setField(activePlan, field.key, next)}
                          onReset={() => setField(activePlan, field.key, (livePlans[activePlan]?.[field.key] ?? null) as PlanFieldValue)}
                        />
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
            <aside className="xl:sticky xl:top-4 xl:self-start">
              <PlanCardPreview values={values[activePlan] || {}} />
              <section className={`${panel} mt-4`}>
                <h2 className="text-base font-extrabold text-slate-950">Draft</h2>
                <p className="mb-3 text-xs font-semibold text-slate-500">
                  {dirtyUnsaved ? "You have edits that are not saved yet." : draftSaved ? "Draft saved." : "No edits."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primaryButton} disabled={busy || !dirtyUnsaved} onClick={() => void saveDraft()}>{busy ? "Saving…" : "Save draft only"}</button>
                  {state.draft ? <button type="button" className={secondaryButton} disabled={busy} onClick={discard}>Discard draft</button> : null}
                </div>
                {preview?.has_draft ? (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-extrabold text-slate-950">What publishing would change ({preview.changes.length})</p>
                    {preview.warnings.map((warning, i) => <p key={i} className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-bold text-amber-900">{warning}</p>)}
                    <ChangeList changes={preview.changes} />
                    <button type="button" className={`${primaryButton} mt-3 w-full`} disabled={busy || !hasChanges || dirtyUnsaved} onClick={() => setShowPublish(true)}>
                      Review and publish
                    </button>
                    {dirtyUnsaved ? <p className="mt-1 text-[11px] font-semibold text-slate-500">Save the draft first.</p> : null}
                  </div>
                ) : null}
              </section>
            </aside>
          </div>

          <div className="sticky bottom-3 z-30 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-white/95 p-3 shadow-lg backdrop-blur" data-testid="plans-action-bar">
            <p className="text-sm font-extrabold text-slate-900">
              {unsavedCount > 0 ? `${unsavedCount} edit${unsavedCount === 1 ? "" : "s"} not applied yet` : hasChanges ? `Draft saved: ${preview?.changes.length} change${preview?.changes.length === 1 ? "" : "s"} waiting to be applied` : "No pending changes. Customers see exactly what is shown as Live."}
            </p>
            <div className="flex flex-wrap gap-2">
              {unsavedCount > 0 ? <button type="button" className={secondaryButton} disabled={busy} onClick={() => setValues(JSON.parse(JSON.stringify(savedPlans)))}>Undo all edits</button> : null}
              {state.draft ? <button type="button" className={secondaryButton} disabled={busy} onClick={discard}>Discard draft</button> : null}
              <button type="button" className={primaryButton} disabled={busy || (unsavedCount === 0 && !hasChanges)} onClick={() => void applyChanges()}>
                {busy ? "Working..." : "Apply changes"}
              </button>
            </div>
          </div>

          <section className={panel}>
            <h2 className="text-base font-extrabold text-slate-950">History</h2>
            <p className="mb-3 text-xs font-semibold text-slate-500">Every published version is kept. Rolling back publishes the old settings as a new version, so the record is never rewritten.</p>
            {state.history.length === 0 ? <p className="text-sm font-semibold text-slate-500">Nothing published yet.</p> : (
              <div className="grid gap-2">
                {state.history.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-violet-100 p-3">
                    <div>
                      <p className="text-sm font-extrabold text-slate-950">
                        Version {item.version} {item.status === "published" ? <Pill tone="green">Live</Pill> : <Pill tone="slate">Earlier</Pill>} {item.rolled_back_from ? <Pill tone="amber">Rollback of v{item.rolled_back_from}</Pill> : null}
                      </p>
                      <p className="text-xs font-semibold text-slate-500">{item.published_at ? new Date(item.published_at).toLocaleString() : ""} · {item.published_by || "unknown"} · {item.change_summary.length} change{item.change_summary.length === 1 ? "" : "s"}</p>
                      {item.change_summary.slice(0, 4).map((change, i) => (
                        <p key={i} className="text-[11px] font-semibold text-slate-600">{change.plan_label}: {change.label} → {Array.isArray(change.after) ? `${change.after.length} items` : show(change.after)}</p>
                      ))}
                    </div>
                    {item.status !== "published" ? <button type="button" className={secondaryButton} disabled={busy} onClick={() => { setPhrase(""); setPricePhrase(""); setRollbackTarget(item.version as number); }}>Roll back to this</button> : null}
                  </div>
                ))}
              </div>
            )}
          </section>

          {showPublish && preview ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
              <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
                <h2 className="text-lg font-extrabold text-slate-950">Publish these changes?</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  Customers will see the new words and prices straight away. Everyone with an active plan ({Object.values(subscribers).reduce((a, b) => a + b, 0)} people) keeps the limits and features they bought until they renew, and is not charged extra.
                </p>
                <div className="mt-3"><ChangeList changes={preview.changes} /></div>
                <label className="mt-4 grid gap-1 text-sm font-bold text-slate-700">
                  Type {PUBLISH_PHRASE} to confirm
                  <input className={input} value={phrase} onChange={(e) => setPhrase(e.target.value)} />
                </label>
                {priceChanged ? (
                  <label className="mt-3 grid gap-1 text-sm font-bold text-rose-700">
                    This changes a price. Also type {PRICE_PHRASE}
                    <input className={input} value={pricePhrase} onChange={(e) => setPricePhrase(e.target.value)} />
                  </label>
                ) : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={secondaryButton} onClick={() => setShowPublish(false)}>Cancel</button>
                  <button type="button" className={primaryButton} disabled={busy || phrase !== PUBLISH_PHRASE || (priceChanged && pricePhrase !== PRICE_PHRASE)} onClick={publish}>
                    {busy ? "Publishing…" : "Publish"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
          {rollbackTarget !== null ? (
            <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
              <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                <h2 className="text-lg font-extrabold text-slate-950">Roll back to version {rollbackTarget}?</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">The old settings are published again as a new version. People who already paid keep what they bought until renewal.</p>
                <label className="mt-4 grid gap-1 text-sm font-bold text-slate-700">
                  Type {PUBLISH_PHRASE} to confirm
                  <input className={input} value={phrase} onChange={(e) => setPhrase(e.target.value)} />
                </label>
                <label className="mt-3 grid gap-1 text-sm font-bold text-slate-700">
                  If this changes a price, also type {PRICE_PHRASE} (otherwise leave blank)
                  <input className={input} value={pricePhrase} onChange={(e) => setPricePhrase(e.target.value)} />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" className={secondaryButton} onClick={() => setRollbackTarget(null)}>Cancel</button>
                  <button type="button" className={primaryButton} disabled={busy || phrase !== PUBLISH_PHRASE} onClick={rollback}>{busy ? "Rolling back…" : "Roll back"}</button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </AppShell>
  );
}


import { useEffect, useState } from "react";

import { UserLabel } from "@/components/UserLabel";
import { input, planLabel, primaryButton, secondaryButton } from "@/components/ui";
import { api, type InstituteConfig, type InstituteOverview } from "@/lib/apiClient";

type Props = { organizationId: string; adminEmail: string | null; canWrite: boolean };

const ROLE_OPTIONS = [
  { value: "institute_owner", label: "Owner" },
  { value: "institute_manager", label: "Manager" },
  { value: "institute_teacher", label: "Member" },
];

function show(value: number | null | undefined) {
  return value === null || value === undefined ? "Unlimited" : String(value);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{title}</p>
      {hint ? <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function InstituteSetup({ organizationId, adminEmail, canWrite }: Props) {
  const [data, setData] = useState<InstituteOverview | null>(null);
  const [draft, setDraft] = useState<InstituteConfig | null>(null);
  const [domainsText, setDomainsText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("institute_teacher");
  const [busyMember, setBusyMember] = useState<string | null>(null);

  function adopt(next: InstituteOverview) {
    setData(next);
    setDraft(next.config);
    setDomainsText(next.config.seats.allowed_email_domains.join(", "));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getInstituteOverview(organizationId)
      .then((res) => { if (!cancelled) { adopt(res); setError(null); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Could not load institute setup."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [organizationId]);

  async function run<T>(work: () => Promise<InstituteOverview>, okMessage: string) {
    setError(null);
    setNotice(null);
    try {
      adopt(await work());
      setNotice(okMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not work.");
    }
  }

  function setLimit(key: string, mode: "default" | "custom" | "unlimited", value?: number) {
    if (!draft) return;
    const limits = { ...draft.limits };
    if (mode === "default") delete limits[key];
    else if (mode === "unlimited") limits[key] = null;
    else limits[key] = value ?? limits[key] ?? 0;
    setDraft({ ...draft, limits });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const domains = domainsText.split(/[,\n ]+/).map((item) => item.trim()).filter(Boolean);
    await run(() => api.saveInstituteConfig(organizationId, { ...draft, seats: { ...draft.seats, allowed_email_domains: domains } }, adminEmail || undefined), "Saved. Members see the new limits within about 15 seconds.");
    setSaving(false);
  }

  if (loading) return <p className="text-xs font-semibold text-slate-500">Loading institute setup...</p>;
  if (!data || !draft) return error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null;

  const limitRows = data.limits;
  return (
    <div className="space-y-4">
      <Section
        title="Ready to hand over?"
        hint="Work down this list. Plan and Owner are the two that must be green before the institute can really use it."
      >
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {data.checklist.map((item) => (
            <li key={item.key} className={`flex items-start gap-2 rounded-lg border p-2 text-xs ${item.done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
              <span className="mt-0.5 font-extrabold">{item.done ? "Done" : "To do"}</span>
              <span>
                <span className="block font-bold">{item.label}</span>
                {item.detail ? <span className="block opacity-80">{item.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Plan and limits"
        hint="This switch is what makes everything below apply. While it is off, members are billed and limited like any normal user. Each limit can follow the base plan, be a number you choose, or be unlimited. Limits are per person."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <input type="checkbox" className="mt-0.5" disabled={!canWrite} checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />
            <span>
              <span className="block font-bold text-slate-800">Institute plan is active</span>
              <span className="block text-slate-500">Members get this plan instead of their own.</span>
            </span>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Built on
            <select className={`${input} mt-1`} disabled={!canWrite} value={draft.base_plan} onChange={(e) => setDraft({ ...draft, base_plan: e.target.value })}>
              {data.base_plan.choices.map((choice) => (
                <option key={choice.code} value={choice.code}>{planLabel(choice.code)}</option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-slate-500">Starting point for every limit you do not change.</span>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Valid until
            <input type="date" className={`${input} mt-1`} disabled={!canWrite} value={draft.valid_until || ""} onChange={(e) => setDraft({ ...draft, valid_until: e.target.value || null })} />
            <span className="mt-1 block font-normal text-slate-500">After this date members drop back to their own plan. Blank means no end.</span>
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-3">Limit</th>
                <th className="py-1 pr-3">Base plan</th>
                <th className="py-1 pr-3">Setting</th>
                <th className="py-1">Members get</th>
              </tr>
            </thead>
            <tbody>
              {limitRows.map((row) => {
                const mode = draft.limits[row.key] === undefined ? "default" : draft.limits[row.key] === null ? "unlimited" : "custom";
                return (
                  <tr key={row.key} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <span className="block font-bold text-slate-800">{row.label}</span>
                      <span className="block text-slate-500">{row.help}</span>
                    </td>
                    <td className="py-2 pr-3">{show(row.base_value)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <select className={`${input} w-32`} disabled={!canWrite} value={mode} onChange={(e) => setLimit(row.key, e.target.value as "default" | "custom" | "unlimited", typeof row.effective_value === "number" ? row.effective_value : 10)}>
                          <option value="default">Follow plan</option>
                          <option value="custom">Set a number</option>
                          <option value="unlimited">Unlimited</option>
                        </select>
                        {mode === "custom" ? (
                          <input type="number" min={0} className={`${input} w-24`} disabled={!canWrite} value={draft.limits[row.key] ?? 0} onChange={(e) => setLimit(row.key, "custom", Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
                        ) : null}
                      </div>
                    </td>
                    <td className="py-2 font-extrabold text-slate-900">{mode === "default" ? show(row.base_value) : mode === "unlimited" ? "Unlimited" : String(draft.limits[row.key])}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <label className="mt-3 block text-xs font-semibold text-slate-600">
          Internal notes (what was agreed with them)
          <textarea className={`${input} mt-1`} rows={2} maxLength={1000} disabled={!canWrite} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
        </label>
      </Section>

      <Section
        title="People and seats"
        hint="Seats cap how many people can be active in this institute at once. Share the join code or link and people join themselves, or add someone by email if they already have an account."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-600">
            Seat limit ({data.seats.used} used)
            <input
              type="number"
              min={1}
              className={`${input} mt-1`}
              placeholder="Unlimited"
              disabled={!canWrite}
              value={draft.seats.max ?? ""}
              onChange={(e) => setDraft({ ...draft, seats: { ...draft.seats, max: e.target.value === "" ? null : Math.max(1, Math.floor(Number(e.target.value) || 1)) } })}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600 sm:col-span-2">
            Allowed email domains (optional)
            <input className={`${input} mt-1`} placeholder="school.edu, school.org" disabled={!canWrite} value={domainsText} onChange={(e) => setDomainsText(e.target.value)} />
            <span className="mt-1 flex items-center gap-2 font-normal text-slate-500">
              <input type="checkbox" disabled={!canWrite} checked={draft.seats.require_domain} onChange={(e) => setDraft({ ...draft, seats: { ...draft.seats, require_domain: e.target.checked } })} />
              Only people with one of these email domains can join with the code
            </span>
          </label>
        </div>

        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50/60 p-3 text-xs">
          <p className="font-extrabold text-slate-800">Join code</p>
          {data.seats.join_code ? (
            <>
              <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-slate-950">{data.seats.join_code}</p>
              <p className="mt-1 break-all text-slate-600">Link to share: {data.seats.join_link}</p>
            </>
          ) : (
            <p className="mt-1 text-slate-500">No code yet. Generate one when you are ready for more people to join.</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={secondaryButton} disabled={!canWrite} onClick={() => run(() => api.changeInstituteJoinCode(organizationId, "generate"), data.seats.join_code ? "New code made. The old one no longer works." : "Join code made.")}>
              {data.seats.join_code ? "Make a new code" : "Generate code"}
            </button>
            {data.seats.join_code ? (
              <button type="button" className={secondaryButton} disabled={!canWrite} onClick={() => run(() => api.changeInstituteJoinCode(organizationId, "clear"), "Join code switched off.")}>Switch code off</button>
            ) : null}
            {data.seats.join_link ? (
              <button type="button" className={secondaryButton} onClick={() => navigator.clipboard?.writeText(data.seats.join_link || "").then(() => setNotice("Link copied.")).catch(() => setNotice("Could not copy; select the link above."))}>Copy link</button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-[14rem] flex-1 text-xs font-semibold text-slate-600">
            Add someone by email
            <input className={`${input} mt-1`} type="email" placeholder="name@school.edu" disabled={!canWrite} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          </label>
          <select className={`${input} w-32`} disabled={!canWrite} value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
          </select>
          <button type="button" className={primaryButton} disabled={!canWrite || !newEmail.trim()} onClick={() => run(() => api.addInstituteMember(organizationId, { email: newEmail.trim(), role: newRole }), "Added.").then(() => setNewEmail(""))}>Add</button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                <th className="py-1 pr-3">Person</th>
                <th className="py-1 pr-3">Role</th>
                <th className="py-1 pr-3">Status</th>
                <th className="py-1 pr-3">Last 30 days</th>
                <th className="py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.teacher_id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3"><UserLabel id={member.teacher_id} name={member.teacher_name} email={member.teacher_email} /></td>
                  <td className="py-2 pr-3">
                    <select className={`${input} w-28`} disabled={!canWrite || busyMember === member.teacher_id} value={member.role} onChange={(e) => { setBusyMember(member.teacher_id); run(() => api.updateInstituteMember(organizationId, member.teacher_id, { role: e.target.value }), "Role changed.").finally(() => setBusyMember(null)); }}>
                      {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                  </td>
                  <td className="py-2 pr-3 capitalize">{member.status}</td>
                  <td className="py-2 pr-3">{member.papers_30d} papers, {member.ai_checks_30d} AI checks</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1.5">
                      {member.status === "active" ? (
                        <button type="button" className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-800" disabled={!canWrite} onClick={() => run(() => api.updateInstituteMember(organizationId, member.teacher_id, { status: "suspended" }), "Seat paused.")}>Pause seat</button>
                      ) : (
                        <button type="button" className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-800" disabled={!canWrite} onClick={() => run(() => api.updateInstituteMember(organizationId, member.teacher_id, { status: "active" }), "Seat restored.")}>Restore seat</button>
                      )}
                      {member.status !== "removed" ? (
                        <button type="button" className="rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-800" disabled={!canWrite} onClick={() => run(() => api.updateInstituteMember(organizationId, member.teacher_id, { status: "removed" }), "Removed. Their own papers and plan are untouched.")}>Remove</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!data.members.length ? (
                <tr><td colSpan={5} className="py-3 text-slate-500">Nobody has joined yet. The owner joins through the activation link; others through the join code.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Section>

      {error ? <p className="text-xs font-semibold text-rose-700">{error}</p> : null}
      {notice ? <p className="text-xs font-semibold text-emerald-700">{notice}</p> : null}
      <div className="flex items-center gap-3">
        <button type="button" className={primaryButton} disabled={!canWrite || saving} onClick={save}>{saving ? "Saving..." : "Save plan, limits and seats"}</button>
        {!canWrite ? <span className="text-xs font-semibold text-amber-800">Read-only: requires organizations.write</span> : null}
      </div>
    </div>
  );
}

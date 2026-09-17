import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { errorNotice, input, label, notice, panel, primaryButton, secondaryButton, table, td, th } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import { api, type AdminAccountsMeta, type AdminAuthAccountRow } from "@/lib/apiClient";

// Phase 2 of the Accounts/RBAC work: this used to be a static, hardcoded
// description of a role model with no backend behind it ("Backend table
// needed next..."). The real table (admin_auth_accounts), the permission
// system (effective_permissions()/admin_has_permission() in admin_auth.py),
// and the endpoints this page calls (GET/POST/PATCH /admin/auth/accounts)
// were all built and applied live in Phase 1. Toyaj explicitly asked this
// go into the existing "Admin Team" tab rather than a new "Accounts" tab.

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Super Admin. Unrestricted access to everything, including managing other admin accounts and billing overrides. Cannot be limited by custom permissions.",
  admin: "Broad read access across the business/platform panel by default. Give specific write permissions below if this person needs to act, not just view.",
  reviewer: "Intended for template-ingestion review (read-only on templates). Not yet enforced on the ingestion dashboard itself - see Phase 4.",
  uploader: "Intended for template-ingestion uploads (read+write on templates). Not yet enforced on the ingestion dashboard itself - see Phase 4.",
  viewer: "Minimal read-only access to this panel's own health/status.",
};

function RoleBadge({ role }: { role: string }) {
  const isOwner = role === "owner";
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-black capitalize ${
        isOwner ? "border-amber-300 bg-amber-50 text-amber-800" : "border-violet-200 bg-violet-50 text-violet-800"
      }`}
    >
      {role}
    </span>
  );
}

function PermissionChecklist({
  permissionKeys,
  selected,
  onToggle,
  disabled,
}: {
  permissionKeys: string[];
  selected: string[];
  onToggle: (key: string) => void;
  disabled?: boolean;
}) {
  if (disabled) {
    return <p className="text-xs font-semibold text-slate-500">Owner is always fully unrestricted - individual permissions don&apos;t apply.</p>;
  }
  return (
    <div className="grid max-h-56 grid-cols-1 gap-1.5 overflow-y-auto rounded-xl border border-violet-100 bg-violet-50/40 p-3 sm:grid-cols-2">
      {permissionKeys.map((key) => (
        <label key={key} className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-violet-300 text-purple-700 focus:ring-violet-300"
            checked={selected.includes(key)}
            onChange={() => onToggle(key)}
          />
          <span className="font-mono">{key}</span>
        </label>
      ))}
    </div>
  );
}

function CreateAccountForm({
  meta,
  onCreated,
}: {
  meta: AdminAccountsMeta;
  onCreated: (admin: AdminAuthAccountRow, tempPassword: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState(meta.roles.find((r) => r !== "owner") || meta.roles[0] || "viewer");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePermission(key: string) {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.createAdminAccount({ email: email.trim(), name: name.trim(), role, permissions: role === "owner" ? [] : permissions });
      onCreated(result.admin, result.temporary_password);
      setOpen(false);
      setEmail("");
      setName("");
      setPermissions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not register this account.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className={primaryButton} onClick={() => setOpen(true)}>
        Register new staff account
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-200 bg-white p-5 shadow-soft">
      <h3 className="text-lg font-black text-slate-950">Register a new staff account</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">
        A one-time temporary password is generated and shown once after you submit this - share it with them out of band. They change it on first login.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className={label}>
          Email
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </label>
        <label className={label}>
          Full name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
        </label>
        <label className={label}>
          Role
          <select className={input} value={role} onChange={(e) => setRole(e.target.value)}>
            {meta.roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <span className="text-[11px] font-semibold text-slate-500">{ROLE_DESCRIPTIONS[role] || ""}</span>
        </label>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-sm font-bold text-slate-700">Custom permissions (optional)</p>
        <p className="mb-2 text-[11px] font-semibold text-slate-500">
          Leave everything unchecked to use this role&apos;s default bundle. Tick specific permissions only if this person needs more or less than the default.
        </p>
        <PermissionChecklist permissionKeys={meta.permission_keys} selected={permissions} onToggle={togglePermission} disabled={role === "owner"} />
      </div>
      {error ? <p className={`${errorNotice} mt-4`}>{error}</p> : null}
      <div className="mt-4 flex gap-2">
        <button type="button" className={primaryButton} disabled={busy || !email.trim() || !name.trim()} onClick={submit}>
          {busy ? "Registering..." : "Register account"}
        </button>
        <button type="button" className={secondaryButton} disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function AccountRow({
  account,
  meta,
  isSelf,
  soleOwner,
  onUpdated,
}: {
  account: AdminAuthAccountRow;
  meta: AdminAccountsMeta;
  isSelf: boolean;
  soleOwner: boolean;
  onUpdated: (admin: AdminAuthAccountRow) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState(account.role);
  const [permissions, setPermissions] = useState<string[]>(account.permissions.filter((p) => p !== "*"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function togglePermission(key: string) {
    setPermissions((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.updateAdminAccount(account.id, { role, permissions: role === "owner" ? [] : permissions });
      onUpdated(result.admin);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this account.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (isSelf) return; // backend blocks this too; mirrored here so the button is never even clickable
    // A misclick here instantly locks out a teammate mid-launch-week with no
    // undo in the UI (has to be manually re-toggled by another admin) - every
    // other destructive admin action in this panel (see user-360.tsx) confirms
    // first, this one didn't.
    const question = account.active
      ? `Deactivate ${account.name || account.email}? They will be signed out and unable to log back in until reactivated.`
      : `Reactivate ${account.name || account.email}?`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.updateAdminAccount(account.id, { active: !account.active });
      onUpdated(result.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change active state.");
    } finally {
      setBusy(false);
    }
  }

  const blockRoleChange = isSelf && account.role === "owner" && soleOwner;

  return (
    <tr>
      <td className={td}>
        <p className="text-sm font-bold text-slate-800">{account.name}{isSelf ? <span className="ml-1 text-[10px] font-black text-purple-700">(you)</span> : null}</p>
        <p className="text-xs text-slate-500">{account.email}</p>
      </td>
      <td className={td}>
        {editing ? (
          <select className={input} value={role} onChange={(e) => setRole(e.target.value)} disabled={blockRoleChange}>
            {meta.roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : (
          <RoleBadge role={account.role} />
        )}
        {blockRoleChange ? <p className="mt-1 text-[10px] font-semibold text-amber-700">You&apos;re the only owner - promote another account first.</p> : null}
      </td>
      <td className={td}>
        {account.role === "owner" ? (
          <p className="text-xs font-semibold text-slate-500">All access</p>
        ) : editing ? (
          <PermissionChecklist permissionKeys={meta.permission_keys} selected={permissions} onToggle={togglePermission} />
        ) : account.permissions.length ? (
          <p className="max-w-xs text-[11px] font-mono text-slate-600">{account.permissions.join(", ")}</p>
        ) : (
          <p className="text-xs font-semibold text-slate-500">Role default ({ROLE_DESCRIPTIONS[account.role] ? "see role" : "standard"})</p>
        )}
      </td>
      <td className={td}>
        <span
          className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-black ${
            account.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-500"
          }`}
        >
          {account.active ? "Active" : "Deactivated"}
        </span>
        <p className="mt-1 text-[11px] text-slate-500">{account.last_login_at ? `Last login ${new Date(account.last_login_at).toLocaleString()}` : "Never signed in"}</p>
      </td>
      <td className={td}>
        {error ? <p className="mb-1 text-[11px] font-semibold text-rose-700">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button type="button" className={secondaryButton} disabled={busy} onClick={save}>
                {busy ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="text-xs font-bold text-slate-500"
                disabled={busy}
                onClick={() => {
                  setEditing(false);
                  setRole(account.role);
                  setPermissions(account.permissions.filter((p) => p !== "*"));
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className={secondaryButton} onClick={() => setEditing(true)}>
              Edit role / permissions
            </button>
          )}
          <button
            type="button"
            className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold transition-colors ${
              account.active ? "border-rose-200 bg-white/85 text-rose-700 hover:bg-rose-50" : "border-emerald-200 bg-white/85 text-emerald-700 hover:bg-emerald-50"
            }`}
            disabled={busy || isSelf}
            title={isSelf ? "You cannot deactivate your own account." : undefined}
            onClick={toggleActive}
          >
            {account.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { admin, hasPermission } = useAdminSession();
  const [accounts, setAccounts] = useState<AdminAuthAccountRow[]>([]);
  const [meta, setMeta] = useState<AdminAccountsMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tempPasswordBanner, setTempPasswordBanner] = useState<{ email: string; password: string } | null>(null);

  const canRead = hasPermission("accounts.read");
  const canWrite = hasPermission("accounts.write");

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([api.listAdminAccounts(), api.getAdminAccountsMeta()])
      .then(([accountsResult, metaResult]) => {
        setAccounts(accountsResult.items);
        setMeta(metaResult);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load admin accounts."))
      .finally(() => setLoading(false));
  }, [canRead]);

  const ownerCount = useMemo(() => accounts.filter((a) => a.role === "owner" && a.active).length, [accounts]);

  function handleUpdated(updated: AdminAuthAccountRow) {
    setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }

  function handleCreated(created: AdminAuthAccountRow, tempPassword: string) {
    setAccounts((prev) => [...prev, created]);
    setTempPasswordBanner({ email: created.email, password: tempPassword });
  }

  if (!canRead) {
    return (
      <AppShell title="Admin Team">
        <section className={panel}>
          <p className="text-sm font-bold text-slate-600">
            You don&apos;t have permission to view staff accounts (requires <code className="font-mono">accounts.read</code>). Ask a Super Admin to grant it if you need
            access here.
          </p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell title="Admin Team">
      <section className={panel}>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-purple-800">Staff accounts</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">Who can access this panel, and what they can do</h2>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Only a Super Admin (role: owner) can register or edit other accounts by default. Every permission checkbox below maps to a real, enforced check in the
          backend - ticking one actually grants that access immediately, nothing here is cosmetic.
        </p>
        {tempPasswordBanner ? (
          <div className={`${notice} mt-4 flex items-start justify-between gap-4`}>
            <div>
              <p className="font-black text-slate-900">Account created for {tempPasswordBanner.email}</p>
              <p className="mt-1 text-sm">
                Temporary password: <span className="rounded bg-white px-2 py-0.5 font-mono font-black">{tempPasswordBanner.password}</span>
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                This is shown once and is not stored anywhere - copy it now and share it with them out of band. They should change it on first login.
              </p>
            </div>
            <button type="button" className="text-xs font-bold text-slate-500" onClick={() => setTempPasswordBanner(null)}>
              Dismiss
            </button>
          </div>
        ) : null}
        {error ? <p className={errorNotice}>{error}</p> : null}
        {loading ? <p className="mt-4 text-sm font-bold text-slate-500">Loading...</p> : null}
        {!loading && canWrite && meta ? (
          <div className="mt-5">
            <CreateAccountForm meta={meta} onCreated={handleCreated} />
          </div>
        ) : null}
        {!loading && !canWrite ? (
          <p className="mt-4 text-xs font-semibold text-slate-500">
            You can view staff accounts but can&apos;t register or edit them (requires <code className="font-mono">accounts.write</code>).
          </p>
        ) : null}
      </section>

      {!loading && meta && accounts.length ? (
        <section className={panel}>
          <div className="overflow-x-auto">
            <table className={table}>
              <thead>
                <tr>
                  <th className={th}>Name / email</th>
                  <th className={th}>Role</th>
                  <th className={th}>Permissions</th>
                  <th className={th}>Status</th>
                  {canWrite ? <th className={th}>Action</th> : null}
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) =>
                  canWrite ? (
                    <AccountRow
                      key={account.id}
                      account={account}
                      meta={meta}
                      isSelf={account.id === admin?.id}
                      soleOwner={ownerCount <= 1}
                      onUpdated={handleUpdated}
                    />
                  ) : (
                    <tr key={account.id}>
                      <td className={td}>
                        <p className="text-sm font-bold text-slate-800">{account.name}</p>
                        <p className="text-xs text-slate-500">{account.email}</p>
                      </td>
                      <td className={td}><RoleBadge role={account.role} /></td>
                      <td className={td}>
                        <p className="text-[11px] font-mono text-slate-600">{account.role === "owner" ? "All access" : account.permissions.join(", ") || "Role default"}</p>
                      </td>
                      <td className={td}>
                        <span className={`inline-block rounded-full border px-2.5 py-1 text-[11px] font-black ${account.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
                          {account.active ? "Active" : "Deactivated"}
                        </span>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className={panel}>
        <h3 className="text-lg font-black text-slate-950">Role reference</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(meta?.roles || ["owner", "admin", "reviewer", "uploader", "viewer"]).map((role) => (
            <div key={role} className="rounded-2xl border border-violet-100 bg-white p-4 shadow-soft">
              <RoleBadge role={role} />
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{ROLE_DESCRIPTIONS[role] || "Custom role."}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

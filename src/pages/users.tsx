import { AppShell } from "@/components/AppShell";
import { panel } from "@/components/ui";

const roles = [
  ['Owner', 'Full access, user management, billing settings, archive/delete authority'],
  ['Admin', 'Approve templates, deprecate unsafe templates, manage support and backups'],
  ['Reviewer', 'Review JSON, run samples, request fixes, cannot archive'],
  ['Uploader', 'Upload QP/MS and save drafts only'],
];

export default function AdminUsersPage() {
  return <AppShell title="Admin Users & Roles"><section className={panel}><h2 className="text-2xl font-black text-slate-950">Role model</h2><p className="mt-2 text-sm font-semibold text-slate-600">This page defines the internal permission structure. Backend table needed next: admin_users with role, active status, last_login_at, and audit identity.</p><div className="mt-5 grid gap-3 md:grid-cols-2">{roles.map(([role, text]) => <div key={role} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-soft"><h3 className="font-black text-slate-950">{role}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{text}</p></div>)}</div></section></AppShell>;
}

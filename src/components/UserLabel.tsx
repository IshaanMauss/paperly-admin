/** Name first, id small underneath. The backend adds `teacher_name` / `teacher_email`
 *  (or `actor_name`) next to every user id in admin answers; this just renders them. */
export function UserLabel({ id, name, email, className = "" }: { id?: string | null; name?: string | null; email?: string | null; className?: string }) {
  const isGuest = (id || "").startsWith("guest:");
  const title = name || (isGuest ? "Guest (no account)" : id ? "Unknown user" : "-");
  return (
    <span className={`inline-flex min-w-0 flex-col ${className}`}>
      <span className="truncate text-sm font-extrabold text-slate-900">{title}</span>
      {email ? <span className="truncate text-xs font-semibold text-slate-500">{email}</span> : null}
      {id ? <span className="truncate font-mono text-[10px] text-slate-400" title={id}>{id}</span> : null}
    </span>
  );
}

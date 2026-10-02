import Link from "next/link";
import { useEffect, useState } from "react";

import { api, type ServerLogProblemGroup } from "@/lib/apiClient";

/** A short, honest list of what is failing right now, for pages where you are about to take a risky action. */
export function RecentProblems({ limit = 3 }: { limit?: number }) {
  const [groups, setGroups] = useState<ServerLogProblemGroup[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getAdminServerLogsSummary()
      .then((summary) => { if (!cancelled) setGroups(summary.problem_groups || []); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">What is failing right now</p>
        <Link href="/logs" className="text-xs font-extrabold text-violet-700 underline">Open Server Logs</Link>
      </div>
      {failed ? <p className="mt-2 text-sm font-semibold text-rose-700">Could not read the server logs, so problems may be hidden from this view.</p> : null}
      {groups && groups.length === 0 ? <p className="mt-2 text-sm font-semibold text-emerald-700">Nothing repeated in recent traffic.</p> : null}
      <ul className="mt-2 space-y-2">
        {(groups || []).slice(0, limit).map((group) => (
          <li key={`${group.method}-${group.path}-${group.status_code}`} className="text-xs font-semibold leading-5 text-slate-700">
            <span className="font-mono font-bold">{group.status_code} {group.path}</span> - {group.count} times, {group.unique_users} named user{group.unique_users === 1 ? "" : "s"}. {group.meaning}
          </li>
        ))}
      </ul>
    </div>
  );
}

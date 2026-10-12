import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { DiagramViewer } from "@/components/architecture/DiagramViewer";
import { Pill } from "@/components/database/dbUi";
import { errorNotice, input, panel } from "@/components/ui";
import { useAdminSession } from "@/lib/adminAuth";
import { DIAGRAMS, START_ID, breadcrumbOf, childrenOf, diagramById, filterDiagrams, parentsOf, relatedOf } from "@/lib/architecture/catalog";
import { FAMILY_BLURBS, FAMILY_LABELS, REPO_LABELS, type Diagram, type Family, type Repo } from "@/lib/architecture/types";

const repoOrder: Repo[] = ["system", "backend", "teacher", "admin"];
const familyOrder: Family[] = ["dfd", "c4", "sequence", "er", "state", "flow", "deployment", "security"];

function levelLabel(d: Diagram) {
  return d.level === undefined ? null : `Level ${d.level}`;
}

function DiagramCard({ diagram, onOpen, hint }: { diagram: Diagram; onOpen: (id: string) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(diagram.id)}
      className="rounded-xl border border-violet-200 bg-white p-4 text-left shadow-soft transition-colors hover:border-purple-300 hover:bg-purple-50/50"
    >
      <span className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {levelLabel(diagram) ? <Pill tone="info">{levelLabel(diagram)}</Pill> : null}
        <Pill>{FAMILY_LABELS[diagram.family]}</Pill>
        <Pill tone="neutral">{REPO_LABELS[diagram.repo]}</Pill>
      </span>
      <span className="block text-sm font-extrabold text-slate-950">{diagram.title}</span>
      <span className="mt-1 block text-xs font-medium leading-5 text-slate-600">{hint ?? diagram.summary}</span>
    </button>
  );
}

export default function ArchitecturePage() {
  const router = useRouter();
  const { admin } = useAdminSession();
  const [repo, setRepo] = useState<Repo | "all">("all");
  const [family, setFamily] = useState<Family | "all">("all");
  const [query, setQuery] = useState("");
  const [showLegend, setShowLegend] = useState(false);

  const isOwner = admin?.role === "owner";
  const requested = typeof router.query.d === "string" ? router.query.d : null;
  const current = diagramById(requested) ?? diagramById(START_ID);

  const list = useMemo(() => filterDiagrams({ repo, family, query }), [repo, family, query]);
  const grouped = useMemo(() => {
    return familyOrder
      .map((f) => ({
        family: f,
        items: list
          .filter((d) => d.family === f)
          .sort((a, b) => (a.level ?? 9) - (b.level ?? 9) || repoOrder.indexOf(a.repo) - repoOrder.indexOf(b.repo) || a.title.localeCompare(b.title)),
      }))
      .filter((g) => g.items.length);
  }, [list]);

  const open = (id: string) => {
    void router.replace({ pathname: router.pathname, query: { d: id } }, undefined, { shallow: true });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    // A link to a diagram that no longer exists falls back to the start diagram instead of showing nothing.
    if (router.isReady && requested && !diagramById(requested)) void router.replace({ pathname: router.pathname }, undefined, { shallow: true });
  }, [router, requested]);

  if (!isOwner) {
    return (
      <AppShell title="Architecture">
        <div className={errorNotice}>The Architecture area is for the owner account only.</div>
      </AppShell>
    );
  }

  const trail = current ? breadcrumbOf(current.id) : [];
  const kids = current ? childrenOf(current) : [];
  const parents = current ? parentsOf(current.id) : [];
  const related = current ? relatedOf(current) : [];

  return (
    <AppShell title="Architecture">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-slate-950">Architecture</h1>
        <p className="mt-1 max-w-3xl text-sm font-medium text-slate-600">
          How Paperly-NT is built, across the backend, the teacher module and this admin panel. Start at the widest data-flow view (level 0) and go deeper, down to single steps (level 3). {DIAGRAMS.length} diagrams. Owner only.
        </p>
        <button type="button" className="mt-2 text-xs font-extrabold text-purple-700 underline" onClick={() => setShowLegend((v) => !v)} aria-expanded={showLegend}>
          {showLegend ? "Hide how to read these" : "How to read these diagrams"}
        </button>
        {showLegend ? (
          <div className={`${panel} mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2`}>
            <p><span className="font-extrabold">Data flow (DFD).</span> Squares are people or outside services, rounded boxes are things the system does, cylinders are stored data, arrows carry the labelled data. Level 0 is one box; each level opens one part of the level above.</p>
            <p><span className="font-extrabold">Sequences.</span> Time runs downwards. Each arrow is one call; a dashed arrow is a reply. Boxes marked alt or opt show the choices.</p>
            <p><span className="font-extrabold">Database.</span> Each box is a table. Lines show how rows point at each other. Most Paperly links are by teacher_id text, not database foreign keys, and the diagrams say so.</p>
            <p><span className="font-extrabold">State machines.</span> Circles are states, arrows are the events that move a thing between them. The labels are the real status words in the code.</p>
            <p className="md:col-span-2"><span className="font-extrabold">Moving around.</span> Drag to move a diagram, Ctrl or Cmd plus the wheel to zoom, or use Fit and Full screen. &quot;Go deeper&quot; opens the next level; the trail above the diagram takes you back up.</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-y-auto" aria-label="Diagram list">
          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by part of the system">
            {(["all", ...repoOrder] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={repo === r}
                onClick={() => setRepo(r)}
                className={`rounded-full border px-3 py-1 text-xs font-extrabold ${repo === r ? "border-purple-600 bg-purple-600 text-white" : "border-violet-200 bg-white text-slate-700 hover:bg-violet-50"}`}
              >
                {r === "all" ? "All" : REPO_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="mb-3 grid gap-2">
            <input className={input} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search diagrams, files, words" aria-label="Search diagrams" />
            <select className={input} value={family} onChange={(e) => setFamily(e.target.value as Family | "all")} aria-label="Filter by kind of diagram">
              <option value="all">All kinds</option>
              {familyOrder.map((f) => (
                <option key={f} value={f}>{FAMILY_LABELS[f]}</option>
              ))}
            </select>
          </div>
          {grouped.length === 0 ? <p className="rounded-xl border border-dashed border-violet-200 p-4 text-sm font-semibold text-slate-500">No diagram matches. Clear the search or filters.</p> : null}
          <nav className="grid gap-4 pb-4">
            {grouped.map((g) => (
              <div key={g.family}>
                <p className="mb-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-slate-500" title={FAMILY_BLURBS[g.family]}>{FAMILY_LABELS[g.family]} ({g.items.length})</p>
                <ul className="grid gap-0.5">
                  {g.items.map((d) => (
                    <li key={d.id}>
                      <button
                        type="button"
                        onClick={() => open(d.id)}
                        aria-current={current?.id === d.id ? "page" : undefined}
                        className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-bold ${current?.id === d.id ? "bg-purple-50 text-purple-800" : "text-slate-700 hover:bg-violet-50"}`}
                      >
                        {d.level !== undefined ? <span className="mt-0.5 shrink-0 rounded bg-violet-100 px-1.5 text-[10px] font-extrabold text-violet-700">L{d.level}</span> : null}
                        <span className="min-w-0">{d.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {current ? (
          <section className="min-w-0" aria-label={current.title}>
            {trail.length > 1 ? (
              <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs font-bold text-slate-500" aria-label="Where you are">
                {trail.map((t, i) => (
                  <span key={t.id} className="flex items-center gap-1">
                    {i > 0 ? <span aria-hidden="true">&rsaquo;</span> : null}
                    {t.id === current.id ? <span className="text-slate-900">{t.title}</span> : <button type="button" className="underline hover:text-purple-700" onClick={() => open(t.id)}>{t.title}</button>}
                  </span>
                ))}
              </nav>
            ) : null}
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              {levelLabel(current) ? <Pill tone="info">{levelLabel(current)}</Pill> : null}
              <Pill>{FAMILY_LABELS[current.family]}</Pill>
              <Pill tone="neutral">{REPO_LABELS[current.repo]}</Pill>
            </div>
            <h2 className="text-xl font-extrabold text-slate-950">{current.title}</h2>
            <p className="mb-3 mt-1 max-w-3xl text-sm font-medium text-slate-600">{current.summary}</p>

            {parents.length ? (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                Zoom out to:
                {parents.map((p) => (
                  <button key={p.id} type="button" className="rounded-full border border-violet-200 bg-white px-2.5 py-1 hover:bg-violet-50" onClick={() => open(p.id)}>{p.title}</button>
                ))}
              </p>
            ) : null}

            <DiagramViewer key={current.id} id={current.id} title={current.title} source={current.source} />

            {kids.length ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-extrabold text-slate-950">Go deeper ({kids.length})</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {kids.map((k) => (
                    <DiagramCard key={k.id} diagram={k} onOpen={open} />
                  ))}
                </div>
              </div>
            ) : null}

            {related.length ? (
              <div className="mt-6">
                <h3 className="mb-2 text-sm font-extrabold text-slate-950">Same area, another angle</h3>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {related.map((r) => (
                    <DiagramCard key={r.id} diagram={r} onOpen={open} />
                  ))}
                </div>
              </div>
            ) : null}

            {current.notes?.length ? (
              <div className={`${panel} mt-6`}>
                <h3 className="mb-2 text-sm font-extrabold text-slate-950">Worth knowing</h3>
                <ul className="grid gap-2 text-sm text-slate-700">
                  {current.notes.map((n) => (
                    <li key={n} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple-500" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {current.files?.length ? (
              <div className={panel}>
                <h3 className="mb-2 text-sm font-extrabold text-slate-950">Where this lives in the code</h3>
                <ul className="grid gap-1 font-mono text-xs text-slate-700">
                  {current.files.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

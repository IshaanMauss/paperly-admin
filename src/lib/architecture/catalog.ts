import type { Diagram, Family, Repo } from "./types";
import { dfdDiagrams } from "./diagrams/dfd";
import { structureDiagrams } from "./diagrams/structure";
import { sequenceDiagrams } from "./diagrams/sequences";
import { dataDiagrams } from "./diagrams/data";
import { teacherDiagrams } from "./diagrams/teacher";
import { adminDiagrams } from "./diagrams/admin";
import { opsDiagrams } from "./diagrams/ops";

export const DIAGRAMS: Diagram[] = [
  ...dfdDiagrams,
  ...structureDiagrams,
  ...sequenceDiagrams,
  ...dataDiagrams,
  ...teacherDiagrams,
  ...adminDiagrams,
  ...opsDiagrams,
];

const byId = new Map(DIAGRAMS.map((d) => [d.id, d]));

/** The first diagram to open: the widest data-flow view. */
export const START_ID = "dfd-0-context";

export function diagramById(id: string | null | undefined): Diagram | null {
  return (id && byId.get(id)) || null;
}

/** Diagrams that list `id` among their children. */
export function parentsOf(id: string): Diagram[] {
  return DIAGRAMS.filter((d) => d.children?.includes(id));
}

/** The path from a top diagram down to `id`, following the first parent each time. */
export function breadcrumbOf(id: string): Diagram[] {
  const path: Diagram[] = [];
  const seen = new Set<string>();
  let current = diagramById(id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = parentsOf(current.id)[0] ?? null;
  }
  return path;
}

export function childrenOf(diagram: Diagram): Diagram[] {
  return (diagram.children ?? []).map((id) => byId.get(id)).filter((d): d is Diagram => Boolean(d));
}

export function relatedOf(diagram: Diagram): Diagram[] {
  return (diagram.related ?? []).map((id) => byId.get(id)).filter((d): d is Diagram => Boolean(d));
}

export type CatalogFilter = { repo: Repo | "all"; family: Family | "all"; query: string };

export function filterDiagrams(filter: CatalogFilter): Diagram[] {
  const q = filter.query.trim().toLowerCase();
  return DIAGRAMS.filter((d) => {
    if (filter.repo !== "all" && d.repo !== filter.repo) return false;
    if (filter.family !== "all" && d.family !== filter.family) return false;
    if (!q) return true;
    return `${d.title} ${d.summary} ${(d.notes ?? []).join(" ")} ${(d.files ?? []).join(" ")}`.toLowerCase().includes(q);
  });
}

/** Problems with the library itself; an empty list means it is consistent. Used by the tests. */
export function catalogProblems(diagrams: Diagram[] = DIAGRAMS): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const d of diagrams) {
    if (ids.has(d.id)) problems.push(`duplicate id: ${d.id}`);
    ids.add(d.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.id)) problems.push(`id is not kebab-case: ${d.id}`);
    if (!d.title.trim() || !d.summary.trim()) problems.push(`missing title or summary: ${d.id}`);
    if ((d.family === "dfd" || d.family === "c4") && d.level === undefined) problems.push(`needs a level: ${d.id}`);
    const first = d.source.trim().split("\n")[0].trim();
    if (!/^(flowchart (TD|LR|TB|RL)|sequenceDiagram|erDiagram|stateDiagram-v2)\b/.test(first)) problems.push(`unknown Mermaid type in ${d.id}: "${first}"`);
    if (d.source.length > 40000) problems.push(`source too long: ${d.id}`);
  }
  for (const d of diagrams) {
    for (const child of d.children ?? []) if (!ids.has(child)) problems.push(`${d.id} lists a missing child: ${child}`);
    for (const rel of d.related ?? []) if (!ids.has(rel)) problems.push(`${d.id} lists a missing related diagram: ${rel}`);
    for (const child of d.children ?? []) {
      const c = diagrams.find((x) => x.id === child);
      if (c && d.level !== undefined && c.level !== undefined && c.level < d.level) problems.push(`${d.id} (level ${d.level}) has a shallower child ${child} (level ${c.level})`);
    }
  }
  // Every diagram must be reachable from the start diagram through children or related links, or be a top diagram of its own family.
  const tops = diagrams.filter((d) => !diagrams.some((p) => p.children?.includes(d.id)));
  const topIds = new Set(tops.map((t) => t.id));
  for (const t of tops) {
    if (t.level !== undefined && t.level > 0 && t.family === "dfd") problems.push(`level ${t.level} DFD has no parent: ${t.id}`);
  }
  if (!topIds.has(START_ID) && diagrams.length) problems.push(`start diagram ${START_ID} must be a top diagram`);
  return problems;
}

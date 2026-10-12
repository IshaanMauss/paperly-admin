/**
 * The architecture library: every diagram is data. A page (src/pages/architecture.tsx) draws them with Mermaid.
 * To add one: add an entry to a file under ./diagrams, list it in its parent's `children`, and the checks in
 * catalog.test.ts tell you if something is wrong (duplicate id, missing child, unreachable diagram).
 */

/** Which repository (or the whole system) a diagram is about. */
export type Repo = "system" | "backend" | "teacher" | "admin";

/** The kind of view. DFD levels 0 to 3 are one family; the rest are other standard software-engineering views. */
export type Family = "dfd" | "c4" | "sequence" | "er" | "state" | "flow" | "deployment" | "security";

export type DiagramLevel = 0 | 1 | 2 | 3;

export type Diagram = {
  /** Stable kebab-case id, used in the page address (?d=...). Never reuse an id for a different diagram. */
  id: string;
  title: string;
  repo: Repo;
  family: Family;
  /** Only for DFD and C4 views: 0 is the widest view, 3 the most detailed. */
  level?: DiagramLevel;
  /** One or two plain sentences: what this diagram shows and why you would open it. */
  summary: string;
  /** Mermaid source (flowchart, sequenceDiagram, erDiagram or stateDiagram-v2). */
  source: string;
  /** Diagrams that zoom into a part of this one. Opening a child is "going deeper". */
  children?: string[];
  /** Sideways links to a neighbouring diagram (same depth, different angle). */
  related?: string[];
  /** Short facts worth knowing while reading, each one checked against the code or docs. */
  notes?: string[];
  /** Where the real thing lives, as repo-relative paths. */
  files?: string[];
};

export const REPO_LABELS: Record<Repo, string> = {
  system: "Whole system",
  backend: "Backend (paperly-mvp)",
  teacher: "Teacher module",
  admin: "Admin panel",
};

export const FAMILY_LABELS: Record<Family, string> = {
  dfd: "Data flow (DFD)",
  c4: "System structure (C4)",
  sequence: "Sequences",
  er: "Database (ER)",
  state: "State machines",
  flow: "Flows and maps",
  deployment: "Deployment and operations",
  security: "Security and trust",
};

export const FAMILY_BLURBS: Record<Family, string> = {
  dfd: "Who sends what to whom, from the widest view (level 0) down to single steps (level 3).",
  c4: "Boxes and arrows at four zoom levels: people and systems, containers, components, code.",
  sequence: "Who calls whom, in order, for one scenario such as sign-in or a payment.",
  er: "Tables and how they relate.",
  state: "The states a thing can be in and what moves it between them.",
  flow: "Page maps, user journeys and decision flows.",
  deployment: "Where each part runs, how it is built, checked and backed up.",
  security: "Trust boundaries, who is allowed to do what, and how it is enforced.",
};

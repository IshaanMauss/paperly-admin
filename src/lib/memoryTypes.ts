// Types for the Question Memory admin pages (backend: /api/admin/memory/*).

export type MemoryOverview = {
  mode_on: boolean;
  paths: string[];
  tables_ready: boolean;
  users_with_memory?: number;
  ledger_rows?: number;
  answer_sets?: Record<string, number>;
  approved_templates?: number;
  events_by_kind?: Record<string, number>;
  faults_7d?: number;
  papers_in_window?: number;
  days?: number;
};

export type MemoryTemplateRow = {
  template_code: string;
  topic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  marks: number | null;
  users: number;
  serves: number;
  pool_size: number | null;
  mode: string | null;
  near_users: number;
  restarted_users: number;
  list_status: string | null;
  coverage: number | null;
  suggestion: string;
};

export type MemorySupplyRow = { topic: string; difficulty: string; marks_bucket: number; path: string; requests: number; forced: number };

export type MemoryEventRow = {
  id: number;
  user_id: string;
  paper_id: string | null;
  kind: string;
  template_code: string | null;
  topic: string | null;
  path: string | null;
  detail: Record<string, unknown>;
  created_at: string | null;
};

export type MemoryUserTemplate = {
  template_code: string;
  topic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  marks: number | null;
  served_count: number;
  pool_size: number;
  mode: string;
  round: number | null;
  position: number | null;
  progress: number | null;
  last_served_at: string | null;
};

export type MemoryUserView = {
  user_id: string;
  paper_count: number;
  settings: { enabled: boolean; rotation: "off" | "soft" };
  templates: MemoryUserTemplate[];
  by_topic: Record<string, { templates: number; serves: number }>;
  papers: { paper_id: string; path: string; paper_seq: number; items: { t: string; tp?: string; d?: string; m?: number; r?: number }[]; created_at: string | null }[];
  events: Omit<MemoryEventRow, "id" | "user_id" | "paper_id">[];
};

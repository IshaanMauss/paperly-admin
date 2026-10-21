// What the admin sees about paper styles (saved by users) and the record each styled paper carries.

export type PaperStyleRow = {
  id: string;
  name: string;
  easy: number;
  medium: number;
  hard: number;
  popular: number;
  marks: number;
  diagrams: string;
  length: string;
  variety: string;
};

export type PaperStylesOverview = {
  tables_ready: boolean;
  users_saved?: number;
  users_customised?: number;
  active_style?: Record<string, number>;
  slots_edited?: Record<string, number>;
  fields_edited?: Record<string, number>;
  active_style_options?: { diagrams: Record<string, number>; length: Record<string, number>; variety: Record<string, number> };
  users_with_popular_on_active?: number;
  avg_marks_active?: number | null;
  edits_7d?: number;
  edits_30d?: number;
  recent?: { user_id: string; version: number; active_style_id: string; updated_at: string | null; email: string | null }[];
  papers?: { papers_30d: number; own_skills: number; popular_skills: number; changed_marks: number; changed_popular: number; popular_used: number; with_notes: number };
};

export type UserPaperStyles = {
  tables_ready: boolean;
  teacher_id: string;
  saved?: boolean;
  styles?: PaperStyleRow[];
  active_style_id?: string;
  version?: number;
  updated_at?: string | null;
  changed?: Record<string, string[]>;
  history?: { version: number; active_style_id: string; at: string | null; changed: Record<string, string[]> }[];
};

/** The few facts shown on each paper row (the full record loads when the row is opened). */
export type PaperRecordSummary = {
  style: string | null;
  marks: number | null;
  got_marks: number | null;
  skills: string | null;
  chosen: number;
  chosen_pop: number;
  changed: string[];
  popular_questions: number;
  notes: number;
};

export type PaperRecordResponse = { worksheet_id: string; teacher_id: string; title: string; created_at: string | null; recipe: unknown };

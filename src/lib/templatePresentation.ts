import type { TemplateSummary } from "@/lib/apiClient";
import { subtopicsFor } from "@/lib/taxonomy";

export function titleCase(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function subtopicLabel(topic: string, value?: string | null) {
  if (!value) return "General";
  return subtopicsFor(topic).find((item) => item.value === value)?.label || titleCase(String(value));
}

export function templatePartSubtopics(template: TemplateSummary) {
  const parts = template.parts || [];
  const values = parts
    .map((part) => (typeof part.subtopic === "string" ? part.subtopic : ""))
    .filter(Boolean);
  if (values.length) return values;
  return template.subtopic ? [template.subtopic] : [];
}

export function combinationKey(values: string[]) {
  return values.join("||");
}

export function combinationLabel(topic: string, values: string[]) {
  return values.map((value) => subtopicLabel(topic, value)).join(" + ");
}

export function humanizeTemplateText(text?: string | null) {
  const raw = String(text || "").replace(/\n/g, " ");
  return raw
    .replace(/\$\{([^}]+)\}/g, "<$1>")
    .replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, "<$1>")
    .replace(/\s+/g, " ")
    .trim();
}

export function teacherExampleText(item: TemplateSummary) {
  return String(item.question_text || item.question_template || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
}

export function teacherPatternText(item: TemplateSummary) {
  return humanizeTemplateText(item.question_template || item.question_text || "");
}

export function teacherSelectionSummary(topic: string, item: TemplateSummary) {
  const form = item.template_type === "multi_part" ? `Chained${item.parts?.length ? ` (${item.parts.length} parts)` : ""}` : "Single";
  const skill = item.template_type === "multi_part" ? combinationLabel(topic, templatePartSubtopics(item)) : subtopicLabel(topic, item.subtopic);
  return {
    form,
    skill,
    level: titleCase(item.difficulty || "medium"),
  };
}

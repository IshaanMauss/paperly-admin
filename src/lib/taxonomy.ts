import taxonomy from "../../shared/taxonomy/igcse_0580_taxonomy.json";

export type TaxonomyOption = { value: string; label: string };
export type Topic = TaxonomyOption & { subtopics: TaxonomyOption[] };

export const SYLLABUS_OPTIONS: TaxonomyOption[] = [
  { value: "0580", label: "0580 Mathematics" },
  { value: "0606", label: "0606 Additional Mathematics" },
  { value: "0607", label: "0607 International Mathematics" },
];

export const TIER_OPTIONS: TaxonomyOption[] = [
  { value: "Core", label: "Core" },
  { value: "Extended", label: "Extended" },
];

export const DIFFICULTY_OPTIONS: TaxonomyOption[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

export const TOPIC_OPTIONS: Topic[] = taxonomy.topics;

export function subtopicsFor(topic: string): TaxonomyOption[] {
  return TOPIC_OPTIONS.find((item) => item.value === topic)?.subtopics || [];
}

export function ensureSubtopic(topic: string, subtopic: string): string {
  const options = subtopicsFor(topic);
  if (!options.length) return "";
  return options.some((item) => item.value === subtopic) ? subtopic : options[0].value;
}

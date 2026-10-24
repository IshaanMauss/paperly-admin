export type RatingRow = {
  id: number;
  teacher_id: string;
  name: string | null;
  email: string | null;
  stars: number;
  comment: string | null;
  source: string;
  platform: string | null;
  created_at: string | null;
};

export type RatingsResponse = {
  total: number;
  average: number;
  by_stars: Record<string, number>;
  prompt_states: Record<string, number>;
  items: RatingRow[];
};

export type ReferralOverview = {
  switch_on: boolean;
  codes: number;
  friends: Record<string, number>;
  trials: Record<string, number>;
  discounts: Record<string, number>;
  keep_yearly: Record<string, number>;
  flags: { same_network_friends: number; rejected_friends: number; discount_reuse: number; trials_not_granted: number };
};
export type ReferralTrialRow = {
  id: number;
  teacher_id: string;
  state: string;
  starts_at: string | null;
  ends_at: string | null;
  prior_plan_code: string | null;
  ai_check_cap: number | null;
  converted_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  cancel_requested_at: string | null;
  frozen_seconds?: number;
  reward_days?: number;
  story?: string;
  person: { name: string | null; email: string | null } | null;
};
export type ReferralPerson = {
  teacher_id: string;
  code: { code: string; created_at: string; disabled_at: string | null; disabled_reason: string | null }[];
  friends: { referee_teacher_id: string; state: string; reason: string | null; checks: Record<string, boolean>; created_at: string; qualified_at: string | null; steps?: { signed_up: boolean; email_verified: boolean; paper_exported: boolean } }[];
  invited_by: { referrer_teacher_id: string; code: string; state: string; reason: string | null; checks: Record<string, boolean>; created_at: string }[];
  trial: { id: number; state: string; starts_at: string | null; ends_at: string | null; prior_plan_code: string | null; frozen_seconds: number; ai_check_cap: number | null; converted_at: string | null; revoked_at: string | null; revoked_by: string | null; revoke_reason: string | null; reward_days?: number; story?: string }[];
  plan_history?: PlanHistoryRow[];
  discount: { id: number; state: string; list_price: number; discount: number; price: number; offered_at: string; expires_at: string; used_at: string | null; used_payment_id: string | null }[];
  keep_yearly: { id: number; state: string; amount: number; order_id: string | null; payment_id: string | null; created_at: string; paid_at: string | null }[];
  events: { occurred_at: string; actor: string; event_type: string; detail: Record<string, unknown> }[];
  people: Record<string, { name: string | null; email: string | null }>;
};
export type ReferralEventRow = { id: number; occurred_at: string; actor: string; teacher_id: string | null; event_type: string; detail: Record<string, unknown> };

export type PlanHistoryRow = { created_at: string; from_plan: string | null; to_plan: string | null; reason: string; source: string | null; days: number | null; detail: Record<string, unknown> | null };

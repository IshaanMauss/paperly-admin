import { useEffect } from "react";
import { createPortal } from "react-dom";

import type { VariantHealthRow } from "@/lib/apiClient";

function Formula({ children }: { children: string }) {
  return <p className="my-2 overflow-x-auto rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 font-mono text-[12.5px] font-semibold leading-6 text-slate-900">{children}</p>;
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits });
}

/**
 * Explains, in plain words, how Variant Health numbers are worked out. The rules here mirror the backend
 * (admin_overview.get_template_variant_health): ratio = total usage / capacity, watch from 50%, exhausted from 90%.
 * Usage is shown as an aggregate across all real accounts (and its average per account), never as a per-user list.
 */
export function VariantFormulaGuide({ open, onClose, example }: { open: boolean; onClose: () => void; example?: VariantHealthRow | null }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;

  const teachers = example?.distinct_teachers_used || 0;
  const total = example?.total_usage_count || 0;
  const capacity = example?.capacity || 0;
  const avg = teachers > 0 ? total / teachers : null;
  const share = avg !== null && capacity > 0 ? avg / capacity : null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/50 p-3" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="formula-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="formula-guide-title" className="text-lg font-extrabold text-slate-950">How these numbers are calculated</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Plain formulas, matching what the server really does.</p>
          </div>
          <button type="button" aria-label="Close" className="rounded-lg px-2 py-1 text-lg font-black text-slate-500 hover:bg-slate-100" onClick={onClose}>
            ×
          </button>
        </div>

        <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-purple-800">1. Capacity (how many different questions exist)</h3>
        <p className="text-sm font-semibold leading-6 text-slate-600">
          The number of different questions the template can show. When a calculated count is stored and the template has not changed since, that exact count is used. Otherwise it is an upper bound: every variable&apos;s possible values multiplied together, ignoring rules that reject some combinations, so the real number can only be smaller.
        </p>
        <Formula>{"capacity = number of distinct valid questions   (exact)\ncapacity ≈ range(a) × range(b) × range(c) …      (upper bound)"}</Formula>

        <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-purple-800">2. Usage (how much it has been drawn from)</h3>
        <p className="text-sm font-semibold leading-6 text-slate-600">
          Usage is one total for the whole template, added up across every real signed-in account. It counts every time the template was used to build a paper. Test accounts, QA preview and admin traffic are left out. It is an aggregate, not a list of individual users.
        </p>
        <Formula>{"total usage = sum of uses by all real accounts\naverage per account = total usage ÷ number of accounts that used it"}</Formula>

        <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-purple-800">3. Health (Healthy, Watch, Exhausted)</h3>
        <Formula>{"usage ratio = total usage ÷ capacity\n\nHealthy    ratio below 50%\nWatch      50% up to 90%\nExhausted  90% or more\nUnknown    no capacity could be worked out"}</Formula>
        <p className="text-sm font-semibold leading-6 text-slate-600">
          This is a team-wide early warning, not proof that one person has seen a repeat. Each account also has its own memory of its last 20 questions and avoids repeats from that on its own.
        </p>

        <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-purple-800">4. How to read the average per account</h3>
        <p className="text-sm font-semibold leading-6 text-slate-600">
          A high ratio with many accounts, each using it a normal amount, means broad healthy use of a small template: widen it. A high ratio from one or two heavy accounts means the total is skewed by them. The table shows the median (the typical account) and the mean ± spread beside the total so you can tell these apart.
        </p>
        <Formula>{"share of the pool one typical account has drawn\n= average per account ÷ capacity"}</Formula>

        {example && teachers > 0 ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold leading-6 text-amber-950">
            <p className="font-extrabold">Worked example: {example.template_code}</p>
            <p>
              Capacity {fmt(capacity, 0)}, total usage {fmt(total, 0)} across {fmt(teachers, 0)} account{teachers === 1 ? "" : "s"}.
            </p>
            <p>
              Ratio = {fmt(total, 0)} ÷ {fmt(capacity, 0)} = {fmt(capacity > 0 ? (total / capacity) * 100 : null, 1)}%. Average per account = {fmt(total, 0)} ÷ {fmt(teachers, 0)} = {fmt(avg, 1)}
              {share !== null ? `, which is ${fmt(share * 100, 2)}% of the pool.` : "."}
            </p>
          </div>
        ) : null}

        <h3 className="mt-5 text-sm font-extrabold uppercase tracking-wider text-purple-800">5. Calculated numbers (combinations, answers, wordings)</h3>
        <Formula>{"combinations = distinct number sets that can appear\nanswers      = distinct final answers a user can see\nwordings     = different ways the question is phrased"}</Formula>
        <p className="text-sm font-semibold leading-6 text-slate-600">
          Small templates are counted exactly by trying every valid combination. Large ones are estimated from real generated questions and marked as an estimate. A template that takes too long to calculate is set aside and shows as unknown until it is edited.
        </p>

        <div className="mt-5 flex justify-end">
          <button type="button" className="rounded-xl border border-violet-300 bg-violet-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-violet-700" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

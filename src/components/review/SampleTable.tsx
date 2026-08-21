import { MathRichText } from "@/components/preview/MathRichText";
import { code, table, td, th } from "@/components/ui";
import type { PreviewSample } from "@/lib/apiClient";

function compactVariables(value: Record<string, unknown>) {
  const entries = Object.entries(value || {});
  if (!entries.length) return "-";
  const visible = entries.slice(0, 8).map(([key, val]) => `${key}: ${String(val)}`);
  return visible.join(", ") + (entries.length > visible.length ? `, +${entries.length - visible.length} more` : "");
}

function toMathInline(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return "-";
  if (text.includes("$") || text.includes("<br") || text.includes("\(")) return text;
  return `$${text}$`;
}

function partAnswers(sample: PreviewSample) {
  if (!sample.parts?.length) return toMathInline(sample.answer || "-");
  return sample.parts
    .map((part) => {
      const record = part as Record<string, unknown>;
      const id = String(record.part_id || "part");
      const value = toMathInline(record.answer_display || record.answer || "-");
      return `${id}: ${value}`;
    })
    .join("; ");
}

export function SampleTable({ samples }: { samples: PreviewSample[] }) {
  if (!samples.length) return <div className="text-slate-500">No samples generated yet.</div>;
  return (
    <div className="overflow-hidden rounded-2xl border border-violet-100">
      <div className="max-h-[34rem] overflow-auto">
        <table className={`${table} min-w-[920px]`}>
          <thead className="sticky top-0 z-10 bg-violet-50/95 backdrop-blur">
            <tr><th className={th}>Sample variables</th><th className={th}>Status</th><th className={th}>Answer</th><th className={th}>Reason</th></tr>
          </thead>
          <tbody className="bg-white">
            {samples.map((sample, index) => (
              <tr key={index}>
                <td className={`${td} max-w-[26rem]`}>
                  <div className={`${code} max-h-24 overflow-auto rounded-xl bg-slate-50 p-2 text-xs leading-relaxed text-slate-700`} title={JSON.stringify(sample.variables)}>{compactVariables(sample.variables)}</div>
                </td>
                <td className={td}><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ${sample.passed ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{sample.passed ? "pass" : "check"}</span></td>
                <td className={`${td} max-w-[16rem] break-words`}><MathRichText text={partAnswers(sample)} className="max-w-none text-sm text-slate-700" /></td>
                <td className={`${td} max-w-[22rem] text-sm text-slate-600`}>{sample.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


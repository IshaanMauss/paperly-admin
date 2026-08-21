import { code } from "@/components/ui";

export function RawTextPreview({ title, text }: { title: string; text: string }) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-extrabold text-slate-950">{title}</h3>
      <div className={`min-h-28 rounded-2xl border border-violet-100 bg-violet-50/60 p-4 text-slate-700 ${code}`}>{text || "No text yet."}</div>
    </div>
  );
}


